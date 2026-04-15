import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CatalogRoutes } from '../../../application/app.routes.catalog';
import { AccountService } from '../../../logic/services/account.service';
import { CardBalanceSnapshotService } from '../../../logic/services/card-balance-snapshot.service';
import { CategoryService } from '../../../logic/services/category.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { ImportPreviewResult, ImportProcessingService } from '../../../logic/services/import-processing.service';
import { MovementService } from '../../../logic/services/movement.service';
import { Account, AccountType } from '../../../logic/types/account';
import { CardBalanceSnapshot } from '../../../logic/types/card-balance-snapshot';
import { Category } from '../../../logic/types/category';
import { Currency } from '../../../logic/types/currency';
import { DuplicityStatus, ImportingTransaction } from '../../../logic/types/importing-transaction';
import { Transaction, TransactionType } from '../../../logic/types/transaction';
import { SharedModule } from '../../../shared/shared.module';
import { DescriptionDialogComponent } from '../movements/description-dialog/description-dialog.component';
import { ExchangeRateDialogComponent } from './exchange-rate-dialog/exchange-rate-dialog.component';
import { ReconciliationDialogComponent, ReconciliationDialogData } from './reconciliation-dialog/reconciliation-dialog.component';

@Component({
  selector: 'app-import-page',
  templateUrl: './import-page.component.html',
  imports: [SharedModule]
})
export class ImportPageComponent implements OnInit {
  accounts: Account[] = [];
  currencies: Currency[] = [];
  categories: Category[] = [];

  selectedAccount: Account | null = null;
  selectedFile: File | null = null;
  parsedMovements: ImportingTransaction[] = [];
  previewColumns = ['exclude', 'date', 'description', 'payee', 'subcategory', 'amount', 'actions'];

  currencyWarnings: string[] = [];
  validationErrors: string[] = [];
  isRecentMovementsExpanded = false;

  movements: Transaction[] = [];
  accountSnapshots: CardBalanceSnapshot[] = [];

  selectedPreviousSnapshotId: string | null = null;
  currentOwedAmount: number | null = null;
  currentSnapshotDate: string = this.toDateInputValue(new Date());
  reconciliationTolerance = 0.01;

  constructor(
    private accountService: AccountService,
    private cardBalanceSnapshotService: CardBalanceSnapshotService,
    private currencyService: CurrencyService,
    private categoryService: CategoryService,
    public movementService: MovementService,
    private importProcessingService: ImportProcessingService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.accountService.getAccounts().subscribe((accounts) => {
      this.accounts = accounts;
      if (this.accounts.length > 0 && !this.selectedAccount) {
        this.selectedAccount = this.accounts[0];
        this.loadMovementsForAccount();
        this.loadSnapshotsForAccount();
      }
    });

    this.currencyService.getCurrencies().subscribe((currencies) => {
      this.currencies = currencies;
    });

    this.categoryService.getCategories().subscribe((categories) => {
      this.categories = categories;
    });
  }

  get selectedAccountIsCredit(): boolean {
    return this.selectedAccount?.type === AccountType.CREDIT;
  }

  get selectedPreviousSnapshot(): CardBalanceSnapshot | null {
    if (!this.selectedPreviousSnapshotId) {
      return null;
    }

    return this.accountSnapshots.find(s => s.id === this.selectedPreviousSnapshotId) || null;
  }

  loadMovementsForAccount(): void {
    if (this.selectedAccount) {
      this.movements = this.movementService.getMovementsByAccountOrCard(this.selectedAccount.id);
      return;
    }
    this.movements = [];
  }

  get movementsForSelectedAccount(): Transaction[] {
    if (!this.selectedAccount) {
      return [];
    }

    const accountMovements = this.movements
      .filter((m) => m.accountOrCardId === this.selectedAccount!.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (!accountMovements.length) {
      return [];
    }

    const lastMovementDate = new Date(accountMovements[0].date);
    const twoWeeksAgo = new Date(lastMovementDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return accountMovements.filter((m) => new Date(m.date) >= twoWeeksAgo);
  }

  onAccountSelect(): void {
    this.selectedFile = null;
    this.parsedMovements = [];
    this.currencyWarnings = [];
    this.validationErrors = [];
    this.loadMovementsForAccount();
    this.loadSnapshotsForAccount();
  }

  loadSnapshotsForAccount(): void {
    if (!this.selectedAccount || this.selectedAccount.type !== AccountType.CREDIT) {
      this.accountSnapshots = [];
      this.selectedPreviousSnapshotId = null;
      this.currentOwedAmount = null;
      this.currentSnapshotDate = this.toDateInputValue(new Date());
      return;
    }

    this.accountSnapshots = this.cardBalanceSnapshotService.getSnapshotsByAccountId(this.selectedAccount.id);
    this.selectedPreviousSnapshotId = this.accountSnapshots.length > 0 ? this.accountSnapshots[0].id : null;
    this.currentOwedAmount = null;
    this.currentSnapshotDate = this.toDateInputValue(new Date());
  }

  async onFileSelect(event: any): Promise<void> {
    const file = event.target.files[0];
    if (!file || !this.selectedAccount) {
      return;
    }

    this.selectedFile = file;
    await this.buildPreview(file);
  }

  private async buildPreview(file: File): Promise<void> {
    if (!this.selectedAccount) {
      return;
    }

    let preview = await this.importProcessingService.processFile(file, this.selectedAccount as any);

    const hasUsd = preview.rows.some((row) => row.currency === 'USD');
    if (hasUsd) {
      const dialogRef = this.dialog.open(ExchangeRateDialogComponent, {
        width: '420px',
        disableClose: true,
        data: { sourceName: this.selectedAccount.name }
      });
      const rate: number | null = await firstValueFrom(dialogRef.afterClosed());
      if (!rate || !Number.isFinite(rate) || rate <= 0) {
        this.validationErrors = ['A valid exchange rate is required for USD transactions.'];
        this.parsedMovements = [];
        return;
      }
      preview = await this.importProcessingService.processFile(file, this.selectedAccount as any, rate);
    }

    this.applyPreview(preview);
    this.cdr.detectChanges();
  }

  private applyPreview(preview: ImportPreviewResult): void {
    this.validationErrors = preview.validationErrors;
    this.parsedMovements = preview.rows as ImportingTransaction[];

    if (this.validationErrors.length > 0) {
      this.parsedMovements = [];
      return;
    }

    this.parsedMovements.forEach((row) => {
      if (row.currency !== (this.selectedAccount?.currencyId || row.currency) && this.selectedAccount?.isDebit) {
        this.currencyWarnings.push(`Row ${row.uuid}: debit sources only support ${this.selectedAccount?.currencyId}`);
      }
    });
  }

  toggleExclude(item: ImportingTransaction): void {
    item.excluded = !item.excluded;
  }

  onSubcategoryChange(item: ImportingTransaction, subcategoryId: string | null): void {
    item.proposedSubcategoryId = subcategoryId;
    item.subcategoryId = subcategoryId;

    if (subcategoryId) {
      const subcategory = this.categories.find((c) => c.id === subcategoryId);
      if (subcategory?.parentId) {
        item.proposedCategoryId = subcategory.parentId;
        item.categoryId = subcategory.parentId;
      }
    }
  }

  get movementsToImport(): number { return this.parsedMovements.filter(m => !m.excluded).length; }

  get duplicateCount(): number { return this.parsedMovements.filter(m => m.duplicityStatus === DuplicityStatus.CONFIRMED).length; }

  get potentialDuplicateCount(): number { return this.parsedMovements.filter(m => m.duplicityStatus === DuplicityStatus.POTENTIAL).length; }

  onImport(): void {
    if (!this.selectedAccount) { alert('Please select an account before importing'); return; }

    const movementsToImport = this.parsedMovements.filter(m => !m.excluded).map(importingMovement => {
      const movement = new Transaction();
      movement.id = importingMovement.id;
      movement.date = importingMovement.date;
      movement.payee = importingMovement.payee;
      movement.bankDescription = importingMovement.bankDescription;
      movement.additionalInfo = importingMovement.additionalInfo;
      movement.categoryId = importingMovement.proposedCategoryId;
      movement.subcategoryId = importingMovement.proposedSubcategoryId;
      movement.amount = importingMovement.amount;
      movement.currency = importingMovement.currency;
      movement.accountOrCardId = importingMovement.accountOrCardId;
      movement.operationNumber = importingMovement.operationNumber ?? null;
      return movement;
    });

    if (movementsToImport.length === 0) {
      return;
    }

    if (!this.selectedAccountIsCredit) {
      this.finishImport(movementsToImport);
      return;
    }

    if (!this.selectedPreviousSnapshot) {
      alert('Select a previous owed snapshot for this card before importing.');
      return;
    }

    if (this.currentOwedAmount === null || Number.isNaN(this.currentOwedAmount)) {
      alert('Enter the current owed amount before importing.');
      return;
    }

    const currentSnapshotDate = new Date(this.currentSnapshotDate);
    if (Number.isNaN(currentSnapshotDate.getTime())) {
      alert('Enter a valid current owed date.');
      return;
    }

    const previousSnapshot = this.selectedPreviousSnapshot;
    const importedMovementsTotal = movementsToImport
      .filter(m => {
        const movementDate = new Date(m.date).getTime();
        const previousDate = new Date(previousSnapshot.snapshotDate).getTime();
        const currentDate = currentSnapshotDate.getTime();
        return movementDate > previousDate && movementDate <= currentDate;
      })
      .reduce((sum, m) => sum + m.amount, 0);

    const expectedCurrentOwed = this.roundTo2(previousSnapshot.owedAmount + importedMovementsTotal);
    const delta = this.roundTo2(this.currentOwedAmount - expectedCurrentOwed);

    const persistSnapshot = (): void => {
      const newSnapshot = new CardBalanceSnapshot();
      newSnapshot.accountId = this.selectedAccount!.id;
      newSnapshot.snapshotDate = currentSnapshotDate;
      newSnapshot.owedAmount = this.currentOwedAmount!;
      newSnapshot.notes = 'Imported batch checkpoint';
      this.cardBalanceSnapshotService.addSnapshot(newSnapshot);
    };

    if (Math.abs(delta) < this.reconciliationTolerance) {
      this.finishImport(movementsToImport);
      persistSnapshot();
      return;
    }

    const dialogData: ReconciliationDialogData = {
      accountName: this.selectedAccount.name,
      previousOwedAmount: previousSnapshot.owedAmount,
      previousSnapshotDate: previousSnapshot.snapshotDate,
      importedMovementsTotal,
      expectedCurrentOwed,
      currentOwedAmount: this.currentOwedAmount,
      delta
    };

    this.dialog.open(ReconciliationDialogComponent, {
      width: '560px',
      data: dialogData
    }).afterClosed().subscribe(confirmed => {
      const finalMovements = [...movementsToImport];

      if (confirmed) {
        finalMovements.push(this.buildInterestAdjustmentMovement(delta, currentSnapshotDate));
      }

      this.finishImport(finalMovements);
      persistSnapshot();
    });
  }

  private buildInterestAdjustmentMovement(delta: number, date: Date): Transaction {
    const movement = new Transaction();
    movement.accountOrCardId = this.selectedAccount!.id;
    movement.date = date;
    movement.payee = this.selectedAccount!.name;
    movement.bankDescription = 'Interest reconciliation adjustment';
    movement.additionalInfo = 'Auto-generated from snapshot reconciliation';
    movement.notes = `Delta adjustment based on owed snapshots. Delta: ${delta.toFixed(2)}`;
    movement.amount = delta;
    movement.currency = this.getSelectedAccountCurrencyCode();
    movement.type = delta < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
    movement.isStub = true;
    (movement as any).adjustmentType = 'INTEREST_RECONCILIATION';
    (movement as any).adjustmentContext = `snapshot:${this.selectedPreviousSnapshotId}->${this.currentSnapshotDate}`;

    const categoryPair = this.getAdjustmentCategoryIds();
    movement.categoryId = categoryPair.categoryId;
    movement.subcategoryId = categoryPair.subcategoryId;

    return movement;
  }

  private getAdjustmentCategoryIds(): { categoryId: string | null, subcategoryId: string | null } {
    const chargesAndFees = this.categories.find(c => c.name.toLowerCase() === 'charges & fees');
    if (chargesAndFees?.parentId) {
      return {
        categoryId: chargesAndFees.parentId,
        subcategoryId: chargesAndFees.id
      };
    }

    const financialMovements = this.categories.find(c => c.name.toLowerCase() === 'financial movements' && c.parentId === null);
    if (financialMovements) {
      return {
        categoryId: financialMovements.id,
        subcategoryId: null
      };
    }

    return {
      categoryId: null,
      subcategoryId: null
    };
  }

  private getSelectedAccountCurrencyCode(): string {
    if (!this.selectedAccount) {
      return '';
    }

    const currency = this.currencies.find(c => c.id === this.selectedAccount!.currencyId);
    return currency?.code || '';
  }

  private finishImport(movements: Transaction[]): void {
    this.movementService.addMovements(movements);
    this.selectedFile = null;
    this.parsedMovements = [];
    this.currencyWarnings = [];
    this.currentOwedAmount = null;
    this.currentSnapshotDate = this.toDateInputValue(new Date());
    this.loadSnapshotsForAccount();
    alert(`${movements.length} movements imported`);
  }

  private roundTo2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  onCancel(): void {
    this.selectedFile = null;
    this.parsedMovements = [];
    this.validationErrors = [];
    this.currencyWarnings = [];
    this.router.navigate([`/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.TRANSACTIONS_MOVEMENTS}`]);
  }

  openDescriptionDialog(item: ImportingTransaction): void {
    const dialogRef = this.dialog.open(DescriptionDialogComponent, {
      width: '500px',
      data: { additionalInfo: item.additionalInfo }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result !== undefined) {
        item.additionalInfo = result;
      }
    });
  }

  updatePayee(item: ImportingTransaction, newPayee: string | undefined): void {
    item.payee = newPayee;
    item.isManualOverride = true;
  }

  getCurrencyDetails(currencyCode: string): { name: string; symbol: string } | null {
    const currency = this.currencies.find((c) => c.code === currencyCode);
    return currency ? { name: currency.code, symbol: currency.symbol } : null;
  }

  isConfirmedDuplicate(item: ImportingTransaction): boolean {
    return item.duplicityStatus === DuplicityStatus.CONFIRMED;
  }

  isPotentialDuplicate(item: ImportingTransaction): boolean {
    return item.duplicityStatus === DuplicityStatus.POTENTIAL;
  }

  isDuplicate(item: ImportingTransaction): boolean {
    return this.isConfirmedDuplicate(item) || this.isPotentialDuplicate(item);
  }

  getDuplicateMovement(item: ImportingTransaction): Transaction | null {
    if (!item.duplicateOfId) {
      return null;
    }

    return this.movements.find((m) => m.id === item.duplicateOfId) || null;
  }

  getCategoryName(categoryId: string | null): string {
    if (!categoryId) {
      return '';
    }

    const category = this.categories.find((c) => c.id === categoryId);
    return category ? category.name : '';
  }

  getSubcategoryName(subcategoryId: string | null): string {
    if (!subcategoryId) {
      return '';
    }

    const subcategory = this.categories.find((c) => c.id === subcategoryId);
    return subcategory ? subcategory.name : '';
  }

  toggleRecentMovements(): void {
    this.isRecentMovementsExpanded = !this.isRecentMovementsExpanded;
  }
}
