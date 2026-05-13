import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CatalogRoutes } from '../../../application/app.routes.catalog';
import { AccountService } from '../../../logic/services/account.service';
import { CategoryService } from '../../../logic/services/category.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { ImportPreviewResult, ImportProcessingService } from '../../../logic/services/import-processing.service';
import { MovementService } from '../../../logic/services/movement.service';
import { Account } from '../../../logic/types/account';
import { Category } from '../../../logic/types/category';
import { Currency } from '../../../logic/types/currency';
import { ImportDateGroup } from '../../../logic/types/import-date-group';
import { DuplicityStatus, ImportingTransaction } from '../../../logic/types/importing-transaction';
import { Transaction } from '../../../logic/types/transaction';
import { SharedModule } from '../../../shared/shared.module';
import { DescriptionDialogComponent } from '../movements/description-dialog/description-dialog.component';
import { ExchangeRateDialogComponent } from './exchange-rate-dialog/exchange-rate-dialog.component';
import { ImportOnlyComponent } from './import-only/import-only.component';


@Component({
  selector: 'app-import-page',
  templateUrl: './import-page.component.html',
  imports: [SharedModule, ImportOnlyComponent]
})
export class ImportPageComponent implements OnInit {
  accounts: Account[] = [];
  currencies: Currency[] = [];
  categories: Category[] = [];

  selectedAccount: Account | null = null;
  selectedFile: File | null = null;
  parsedMovements: ImportingTransaction[] = [];
  existingTransactions: Transaction[] = [];
  importDateGroups: ImportDateGroup[] = [];
  markedForDeletion = new Set<string>();

  currencyWarnings: string[] = [];
  validationErrors: string[] = [];
  isRecentMovementsExpanded = false;

  movements: Transaction[] = [];

  constructor(
    private accountService: AccountService,
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
      }
    });

    this.currencyService.getCurrencies().subscribe((currencies) => {
      this.currencies = currencies;
    });

    this.categoryService.getCategories().subscribe((categories) => {
      this.categories = categories;
    });
  }

  get earliestFileDate(): string | null {
    const dates = this.parsedMovements.map((m) => String(m.date)).sort();
    return dates[0] ?? null;
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
    this.existingTransactions = [];
    this.importDateGroups = [];
    this.currencyWarnings = [];
    this.validationErrors = [];
    this.loadMovementsForAccount();
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
    this.existingTransactions = preview.existingTransactions || [];
    this.markedForDeletion = new Set<string>();
    this.rebuildImportDateGroups();

    if (this.validationErrors.length > 0) {
      this.parsedMovements = [];
      this.existingTransactions = [];
      this.importDateGroups = [];
      return;
    }

    this.parsedMovements.forEach((row) => {
      if (row.currency !== (this.selectedAccount?.currencyId || row.currency) && this.selectedAccount?.isDebit) {
        this.currencyWarnings.push(`Row ${row.uuid}: debit sources only support ${this.selectedAccount?.currencyId}`);
      }
    });
  }

  toggleExclude(item: ImportingTransaction, excluded?: boolean): void {
    item.excluded = typeof excluded === 'boolean' ? excluded : !item.excluded;
    this.cdr.detectChanges();
  }

  toggleDeleteMark(tx: Transaction): void {
    const updated = new Set(this.markedForDeletion);
    if (updated.has(tx.id)) {
      updated.delete(tx.id);
    } else {
      updated.add(tx.id);
    }
    this.markedForDeletion = updated;
    this.cdr.detectChanges();
  }

  get markedForDeletionCount(): number {
    return this.markedForDeletion.size;
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

  get duplicateCount(): number {
    return this.parsedMovements.filter(m => !m.excluded && m.duplicityStatus === DuplicityStatus.CONFIRMED).length;
  }

  get potentialDuplicateCount(): number {
    return this.parsedMovements.filter(m => !m.excluded && m.duplicityStatus === DuplicityStatus.POTENTIAL).length;
  }

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
      movement.amountPen = importingMovement.amountPen;
      movement.exchangeRate = importingMovement.exchangeRate;
      movement.accountOrCardId = importingMovement.accountOrCardId;
      movement.operationNumber = importingMovement.operationNumber ?? null;
      return movement;
    });

    if (movementsToImport.length === 0) {
      return;
    }

    this.finishImport(movementsToImport);
  }

  private finishImport(movements: Transaction[]): void {
    this.markedForDeletion.forEach(id => this.movementService.deleteMovement(id));
    this.movementService.addMovements(movements);
    this.selectedFile = null;
    this.parsedMovements = [];
    this.existingTransactions = [];
    this.importDateGroups = [];
    this.markedForDeletion = new Set<string>();
    this.currencyWarnings = [];
    alert(`${movements.length} movements imported`);
  }

  onCancel(): void {
    this.selectedFile = null;
    this.parsedMovements = [];
    this.existingTransactions = [];
    this.importDateGroups = [];
    this.markedForDeletion = new Set<string>();
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

  trackByImportDateGroup(_index: number, group: ImportDateGroup): string {
    return group.dateKey;
  }

  trackByImportingTransaction(_index: number, row: ImportingTransaction): string {
    return row.id;
  }

  trackByTransaction(_index: number, tx: Transaction): string {
    return tx.id;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseLocalDate(dateString: string): Date {
    return new Date(`${dateString}T00:00:00`);
  }

  private toDateKey(value: string | Date): string | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : this.toDateInputValue(value);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return this.toDateInputValue(parsed);
  }

  private rebuildImportDateGroups(): void {
    const groups = new Map<string, ImportDateGroup>();

    const ensureGroup = (value: string | Date): ImportDateGroup | null => {
      const dateKey = this.toDateKey(value);
      if (!dateKey) {
        return null;
      }

      const current = groups.get(dateKey);
      if (current) {
        return current;
      }

      const created: ImportDateGroup = {
        dateKey,
        date: this.parseLocalDate(dateKey),
        incoming: [],
        existing: []
      };
      groups.set(dateKey, created);
      return created;
    };

    this.parsedMovements.forEach((row) => {
      const group = ensureGroup(row.date);
      if (group) {
        group.incoming.push(row);
      }
    });

    this.existingTransactions.forEach((tx) => {
      const group = ensureGroup(tx.date);
      if (group) {
        group.existing.push(tx);
      }
    });

    this.importDateGroups = Array.from(groups.values())
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}
