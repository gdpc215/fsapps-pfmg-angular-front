import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { AppSettings } from '../../../../core/models/app-settings.model';
import { GmailMovement, GmailUnparsed } from '../../../../core/models/gmail-sync.model';
import { RawImportRow } from '../../../../core/models/import-batch.model';
import { AccountType, Transaction } from '../../../../core/models/transaction.model';
import {
  DuplicationFlag,
  DuplicationLogicService,
} from '../../../../core/services/duplication-logic.service';
import { CategoryMatchingService } from '../../../../core/services/category-matching.service';
import { RecurrentMatchingService } from '../../../../core/services/recurrent-matching.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { StorageService, StorageWriteError } from '../../../../core/services/storage.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { CategoryService } from '../../../categories/services/category.service';
import { DuplicationCollectionService } from '../../../categories/services/duplication-collection.service';
import { RecurrentTransactionService } from '../../../recurrent-transactions/services/recurrent-transaction.service';
import { GmailSyncService, ResolvedAccount } from '../../services/gmail-sync.service';

interface AccountOption {
  accountId: string;
  accountType: AccountType;
  label: string;
}

interface GmailSyncRow {
  movement: GmailMovement;
  raw: RawImportRow;
  resolved: ResolvedAccount | null;
  flag: DuplicationFlag;
  matchingTransaction?: Transaction;
  subcategoryId?: string;
  pendingFlag: boolean;
  checked: boolean;
  alreadyProcessed: boolean;
}

@Component({
  selector: 'app-gmail-sync',
  standalone: false,
  templateUrl: './gmail-sync.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GmailSyncComponent implements OnInit {
  settings!: AppSettings;

  sinceDateTime = '';
  untilDateTime = '';
  /** 0 until the user sets it; only required when the fetched batch has USD rows. */
  usdExchangeRate = 0;

  isLoading = false;
  hasFetched = false;

  rows: GmailSyncRow[] = [];
  unparsed: GmailUnparsed[] = [];
  lastResponseMeta: { count: number; since?: string; until?: string } | null = null;

  accountOptions: AccountOption[] = [];
  subcategoryLabels: Record<string, string> = {};

  constructor(
    private gmailSyncService: GmailSyncService,
    private settingsService: SettingsService,
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private collectionService: DuplicationCollectionService,
    private duplicationLogicService: DuplicationLogicService,
    private categoryMatchingService: CategoryMatchingService,
    private recurrentTransactionService: RecurrentTransactionService,
    private recurrentMatchingService: RecurrentMatchingService,
    private storageService: StorageService,
    private dialog: MatDialog,
    private router: Router,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.settings = this.settingsService.getSettings();
    const now = new Date();
    this.untilDateTime = this.toLocalInput(now);
    this.sinceDateTime = this.settings.strLastGmailSyncAt
      ? this.toLocalInput(new Date(this.settings.strLastGmailSyncAt))
      : this.toLocalInput(new Date(now.getTime() - 24 * 3600 * 1000));
  }

  get configured(): boolean {
    return !!this.settings?.strGmailSyncUrl && !!this.settings?.strGmailSyncToken;
  }

  get hasUsdRows(): boolean {
    return this.rows.some(r => r.movement.currency === 'USD');
  }

  get rateInvalid(): boolean {
    return this.hasUsdRows && (!this.usdExchangeRate || this.usdExchangeRate <= 0);
  }

  get importableCount(): number {
    return this.rows.filter(r => this.isImportable(r)).length;
  }

  isImportable(r: GmailSyncRow): boolean {
    return r.checked && !!r.resolved && !r.alreadyProcessed && r.flag !== 'AUTO_DUPLICATE';
  }

  onFetch(): void {
    if (!this.configured || this.isLoading) return;

    const sinceIso = new Date(this.sinceDateTime).toISOString();
    const untilIso = new Date(this.untilDateTime).toISOString();
    if (isNaN(Date.parse(sinceIso)) || isNaN(Date.parse(untilIso))) {
      this.snackbar.error('Please provide a valid "since" and "until" date/time.');
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    this.gmailSyncService
      .fetchMovements(this.settings.strGmailSyncUrl!, this.settings.strGmailSyncToken!, sinceIso, untilIso)
      .subscribe({
        next: resp => {
          this.isLoading = false;
          this.hasFetched = true;
          if (!resp || resp.ok === false) {
            this.snackbar.error(`Gmail sync failed: ${resp?.error ?? 'unknown error'}`);
            this.rows = [];
            this.unparsed = [];
            this.cdr.markForCheck();
            return;
          }
          this.buildRows(resp.movements ?? []);
          this.unparsed = resp.unparsed ?? [];
          this.lastResponseMeta = {
            count: resp.count ?? resp.movements?.length ?? 0,
            since: resp.since,
            until: resp.until,
          };
          this.cdr.markForCheck();
        },
        error: err => {
          this.isLoading = false;
          this.hasFetched = true;
          this.snackbar.error('Could not reach the Gmail connector. Check the URL and token in Settings.');
          console.error('Gmail sync request failed', err);
          this.cdr.markForCheck();
        },
      });
  }

  private buildRows(movements: GmailMovement[]): void {
    this.refreshLookups();
    const processed = new Set(this.settings.arrProcessedGmailMessageIds ?? []);

    const rows: GmailSyncRow[] = movements.map(m => ({
      movement: m,
      raw: this.gmailSyncService.toRawImportRow(m, this.usdExchangeRate),
      resolved: this.gmailSyncService.resolveAccount(m, this.settings),
      flag: 'NONE' as DuplicationFlag,
      matchingTransaction: undefined,
      subcategoryId: undefined,
      pendingFlag: false,
      checked: false,
      alreadyProcessed: processed.has(m.messageId),
    }));

    // annotate() compares within a single account — group resolved rows and annotate per group.
    const byAccount = new Map<string, GmailSyncRow[]>();
    for (const row of rows) {
      if (!row.resolved || row.alreadyProcessed) continue;
      let group = byAccount.get(row.resolved.accountId);
      if (!group) {
        group = [];
        byAccount.set(row.resolved.accountId, group);
      }
      group.push(row);
    }
    for (const group of byAccount.values()) {
      this.annotateGroup(group);
    }

    this.rows = rows;
  }

  private annotateGroup(group: GmailSyncRow[]): void {
    if (group.length === 0) return;
    const { accountId, accountType } = group[0].resolved!;
    const settings = this.settingsService.getSettings();
    const annotated = this.duplicationLogicService.annotate(
      group.map(r => r.raw),
      this.transactionService.getAll(),
      this.collectionService.getAll(),
      accountId,
      accountType,
      settings.boolP2RuleEnabled,
    );
    const rules = this.categoryService.getRules();
    group.forEach((row, i) => {
      const a = annotated[i];
      row.flag = a.flag;
      row.matchingTransaction = a.matchingTransaction;
      row.checked = a.checked;
      row.subcategoryId = a.subcategoryId ?? this.categoryMatchingService.match(row.raw.description, rules);
    });
  }

  onAccountChange(row: GmailSyncRow, accountId: string): void {
    const card = this.creditCardService.getById(accountId);
    const accountType: AccountType = card ? 'CREDIT_CARD' : 'DEBIT_ACCOUNT';
    row.resolved = { accountId, accountType };
    if (!row.alreadyProcessed) {
      this.annotateGroup([row]);
    }
    this.cdr.markForCheck();
  }

  onRateChange(): void {
    // amountPen depends on the rate — recompute (USD rows change, PEN rows are unaffected).
    for (const row of this.rows) {
      row.raw = this.gmailSyncService.toRawImportRow(row.movement, this.usdExchangeRate);
    }
    this.cdr.markForCheck();
  }

  togglePending(row: GmailSyncRow): void {
    row.pendingFlag = !row.pendingFlag;
    this.cdr.markForCheck();
  }

  onImport(): void {
    if (this.rateInvalid) {
      this.snackbar.error('Enter a USD exchange rate greater than 0.');
      return;
    }
    const toImport = this.rows.filter(r => this.isImportable(r));
    if (toImport.length === 0) {
      this.snackbar.info('Nothing selected to import.');
      return;
    }

    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Confirm Gmail import',
        message: `Import ${toImport.length} transaction(s) from Gmail? This cannot be undone.`,
        confirmLabel: 'Import',
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) this.doImport(toImport);
    });
  }

  private doImport(toImport: GmailSyncRow[]): void {
    try {
      this.transactionService.saveMany(
        toImport.map(row => ({
          accountId: row.resolved!.accountId,
          accountType: row.resolved!.accountType,
          dateTransaction: row.raw.dateTransaction,
          strDescription: row.raw.description,
          strCurrency: row.raw.currency,
          decAmount: row.raw.amount,
          decAmountPen: row.raw.amountPen,
          subcategoryId: row.subcategoryId,
          strNotes: `BCP email · ${row.movement.subject}`,
          strOperationNumber: row.raw.strOperationNumber,
          strStatus: (row.pendingFlag ? 'PENDING' : 'ACTIVE') as 'PENDING' | 'ACTIVE',
        })),
      );

      // Automatic recurrent matching against the new active set (mirrors the import wizard).
      const recurrents = this.recurrentTransactionService.getAll();
      const existingMatches = this.recurrentTransactionService.getAllMatches();
      const allActive = this.transactionService.getActive();
      const todayDate = new Date().toISOString().slice(0, 10);
      for (const result of this.recurrentMatchingService.findAutomaticMatches(
        recurrents,
        existingMatches,
        allActive,
        todayDate,
      )) {
        this.recurrentTransactionService.saveMatch({
          recurrentTransactionId: result.recurrent.id,
          strIterationKey: result.iterationKey,
          transactionId: result.transaction.id,
          boolDone: true,
          dateDone: todayDate,
          strMatchMode: 'AUTOMATIC',
        });
      }

      // Persist the dedup guard + last-sync marker.
      const processed = [
        ...(this.settingsService.getSettings().arrProcessedGmailMessageIds ?? []),
        ...toImport.map(r => r.movement.messageId),
      ];
      this.settingsService.saveSettings({
        arrProcessedGmailMessageIds: processed.slice(-500),
        strLastGmailSyncAt: new Date(this.untilDateTime).toISOString(),
      });

      const WARN_THRESHOLD = 4 * 1024 * 1024;
      if (this.storageService.getTotalBytes() > WARN_THRESHOLD) {
        this.snackbar.info('Storage is nearly full (>4 MB). Consider removing old data.');
      }

      this.snackbar.success(`Gmail import complete — ${toImport.length} transaction(s) saved.`);
      this.router.navigate(['/transactions']);
    } catch (err) {
      if (err instanceof StorageWriteError) {
        this.snackbar.error('Save failed — storage quota exceeded. No data was written.');
      } else {
        throw err;
      }
    }
  }

  private refreshLookups(): void {
    const cards = this.creditCardService.getAll().map<AccountOption>(c => ({
      accountId: c.id,
      accountType: 'CREDIT_CARD',
      label: c.strName,
    }));
    const accounts = this.debitAccountService.getAll().map<AccountOption>(a => ({
      accountId: a.id,
      accountType: 'DEBIT_ACCOUNT',
      label: a.strName,
    }));
    this.accountOptions = [...cards, ...accounts];

    const cats = new Map(
      this.categoryService.getCategories().map<[string, string]>(c => [c.id, c.strName]),
    );
    this.subcategoryLabels = {};
    for (const s of this.categoryService.getSubcategories()) {
      this.subcategoryLabels[s.id] = `${cats.get(s.categoryId) ?? '?'} / ${s.strName}`;
    }
  }

  private toLocalInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
