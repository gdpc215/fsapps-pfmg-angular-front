import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MatStepper } from '@angular/material/stepper';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ImportWizardStateService } from '../../state/import-wizard-state.service';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { ImportBatchService } from '../../services/import-batch.service';
import { RecurrentTransactionService } from '../../../recurrent-transactions/services/recurrent-transaction.service';
import { RecurrentMatchingService } from '../../../../core/services/recurrent-matching.service';
import { StorageService, StorageWriteError } from '../../../../core/services/storage.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-step-finalize',
  standalone: false,
  templateUrl: './step-finalize.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepFinalizeComponent {
  @Input() stepper!: MatStepper;

  constructor(
    public stateService: ImportWizardStateService,
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
    private transactionService: TransactionService,
    private importBatchService: ImportBatchService,
    private recurrentTransactionService: RecurrentTransactionService,
    private recurrentMatchingService: RecurrentMatchingService,
    private storageService: StorageService,
    private dialog: MatDialog,
    private router: Router,
    private snackbar: SnackbarService,
  ) {}

  get state() { return this.stateService.getState(); }

  get checkedCount(): number {
    return this.state.annotatedRows.filter(r => r.checked).length;
  }

  get skippedCount(): number {
    return this.state.annotatedRows.filter(r => r.flag === 'AUTO_DUPLICATE').length;
  }

  get pendingCount(): number {
    return this.state.annotatedRows.filter(r => r.pendingFlag && r.checked).length;
  }

  get accountName(): string {
    const { accountId, accountType } = this.state;
    if (!accountId) return '';
    if (accountType === 'CREDIT_CARD') {
      return this.creditCardService.getById(accountId)?.strName ?? accountId;
    }
    return this.debitAccountService.getById(accountId)?.strName ?? accountId;
  }

  onSave(): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Confirm import',
          message: `Import ${this.checkedCount} transactions into ${this.accountName}? This cannot be undone.`,
          confirmLabel: 'Import',
        },
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.doSave();
    });
  }

  private doSave(): void {
    try {
      const state = this.stateService.getState();
      const checkedRows = state.annotatedRows.filter(r => r.checked);

      const batch = this.importBatchService.save({
        accountId: state.accountId!,
        accountType: state.accountType!,
        dateImport: new Date().toISOString().slice(0, 10),
        decUsdExchangeRate: state.usdExchangeRate!,
        decBalanceAtImport: state.accountType === 'CREDIT_CARD'
          ? -Math.abs(state.currentBalance!)
          : Math.abs(state.currentBalance!),
      });

      this.transactionService.saveMany(checkedRows.map(row => ({
        accountId: state.accountId!,
        accountType: state.accountType!,
        importBatchId: batch.id,
        dateTransaction:    row.raw.dateTransaction,
        strDescription:     row.raw.description,
        strCurrency:        row.raw.currency,
        decAmount:          row.raw.amount,
        decAmountPen:       row.raw.amountPen,
        subcategoryId:      row.subcategoryId,
        strNotes:           row.note,
        strOperationNumber: row.raw.strOperationNumber,
        strStatus:          (row.pendingFlag ? 'PENDING' : 'ACTIVE') as any,
      })));

      // Automatic recurrent matching
      const recurrents = this.recurrentTransactionService.getAll();
      const existingMatches = this.recurrentTransactionService.getAllMatches();
      const allActive = this.transactionService.getActive();
      const todayDate = new Date().toISOString().slice(0, 10);
      const newMatches = this.recurrentMatchingService.findAutomaticMatches(
        recurrents, existingMatches, allActive, todayDate
      );
      for (const result of newMatches) {
        this.recurrentTransactionService.saveMatch({
          recurrentTransactionId: result.recurrent.id,
          strIterationKey: result.iterationKey,
          transactionId: result.transaction.id,
          boolDone: true,
          dateDone: todayDate,
          strMatchMode: 'AUTOMATIC',
        });
      }

      // Storage warning
      const WARN_THRESHOLD = 4 * 1024 * 1024;
      if (this.storageService.getTotalBytes() > WARN_THRESHOLD) {
        this.snackbar.info('Storage is nearly full (>4 MB). Consider removing old data.');
      }

      this.stateService.reset();
      this.snackbar.success(`Import complete — ${checkedRows.length} transactions saved.`);

      if (state.accountType === 'CREDIT_CARD') {
        this.router.navigate(['/conciliation']);
      } else {
        this.router.navigate(['/transactions']);
      }
    } catch (err) {
      if (err instanceof StorageWriteError) {
        this.snackbar.error('Save failed — storage quota exceeded. No data was written.');
      } else {
        throw err;
      }
    }
  }
}
