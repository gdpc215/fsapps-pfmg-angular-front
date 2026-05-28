import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { CategoryService } from '../../../categories/services/category.service';
import { DuplicationCollectionService } from '../../../categories/services/duplication-collection.service';
import { ImportWizardStateService } from '../../state/import-wizard-state.service';
import { ExcelParserService, ParseValidationError } from '../../../../core/services/excel-parser.service';
import { DuplicationLogicService } from '../../../../core/services/duplication-logic.service';
import { CategoryMatchingService } from '../../../../core/services/category-matching.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AccountType } from '../../../../core/models/transaction.model';

@Component({
  selector: 'app-step-upload',
  standalone: false,
  templateUrl: './step-upload.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepUploadComponent {
  @Input() stepper!: MatStepper;

  form = new FormGroup({
    accountId:       new FormControl<string|null>(null, Validators.required),
    currentBalance:  new FormControl<number|null>(null, [Validators.required]),
    usdExchangeRate: new FormControl<number>(1.00, [Validators.required, Validators.min(0.01)]),
  });

  selectedFile: File | null = null;
  fileError: string | null = null;
  isLoading = false;
  hasUsdRows = false;
  hasMultipleSheets = false;
  selectedAccountType: AccountType | null = null;

  creditCards$ = this.creditCardService.cards$;
  debitAccounts$ = this.debitAccountService.accounts$;

  constructor(
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private collectionService: DuplicationCollectionService,
    private settingsService: SettingsService,
    private excelParserService: ExcelParserService,
    private duplicationLogicService: DuplicationLogicService,
    private categoryMatchingService: CategoryMatchingService,
    private importWizardStateService: ImportWizardStateService,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef,
  ) {}

  onAccountSelect(accountId: string): void {
    const card = this.creditCardService.getById(accountId);
    this.selectedAccountType = card ? 'CREDIT_CARD' : 'DEBIT_ACCOUNT';
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.fileError = null;
    if (!file) { this.selectedFile = null; return; }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.fileError = 'Only .xlsx files are supported.';
      this.selectedFile = null;
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.fileError = 'File exceeds 10 MB limit.';
      this.selectedFile = null;
      return;
    }
    this.selectedFile = file;
  }

  async onNext(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.selectedFile) {
      if (!this.selectedFile) this.fileError = 'Please select a file.';
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      const usdExchangeRate = this.form.value.usdExchangeRate ?? 1;
      const parseResult = await this.excelParserService.parseFile(this.selectedFile, usdExchangeRate);
      this.hasUsdRows = parseResult.hasUsdRows;
      this.hasMultipleSheets = parseResult.hasMultipleSheets;

      if (parseResult.rows.length === 0) {
        this.snackbar.error('No valid rows found — check file format.');
        this.isLoading = false;
        this.cdr.markForCheck();
        return;
      }

      const accountId = this.form.value.accountId!;
      const accountType = this.selectedAccountType!;
      const settings = this.settingsService.getSettings();

      const annotated = this.duplicationLogicService.annotate(
        parseResult.rows,
        this.transactionService.getAll(),
        this.collectionService.getAll(),
        accountId,
        accountType,
        settings.boolP2RuleEnabled,
      );

      const rules = this.categoryService.getRules();
      const annotatedWithCategories = annotated.map(row => ({
        ...row,
        subcategoryId: row.subcategoryId ?? this.categoryMatchingService.match(row.raw.description, rules),
      }));

      const dates = parseResult.rows.map(r => r.dateTransaction).sort();
      const earliest = dates[0];
      const contextTxns = earliest
        ? this.transactionService.getActive().filter(t =>
            t.accountId === accountId &&
            t.dateTransaction >= earliest
          )
        : [];

      this.importWizardStateService.patch({
        accountId,
        accountType,
        currentBalance: this.form.value.currentBalance!,
        usdExchangeRate,
        annotatedRows: annotatedWithCategories,
        contextTransactionIds: contextTxns.map(t => t.id),
        pendingDeletions: [],
      });

      this.stepper.next();
    } catch (err) {
      if (err instanceof ParseValidationError) {
        this.snackbar.error(`File error: ${err.message}`);
      } else {
        this.snackbar.error('Failed to parse file. Please check the format.');
      }
    }

    this.isLoading = false;
    this.cdr.markForCheck();
  }
}
