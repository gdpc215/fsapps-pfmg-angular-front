import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import * as XLSX from 'xlsx';
import { AccountService } from '../../../logic/services/account.service';
import { CardBalanceSnapshotService } from '../../../logic/services/card-balance-snapshot.service';
import { CategoryService } from '../../../logic/services/category.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { MovementService } from '../../../logic/services/movement.service';
import { RecurrentTransactionService } from '../../../logic/services/recurrent-transaction.service';
import { Account, AccountType } from '../../../logic/types/account';
import { CardBalanceSnapshot } from '../../../logic/types/card-balance-snapshot';
import { Category } from '../../../logic/types/category';
import { Currency } from '../../../logic/types/currency';
import { DuplicityStatus, ImportingMovement } from '../../../logic/types/importing-movement';
import { Movement, MovementType } from '../../../logic/types/movement';
import { Utilities } from '../../../logic/utilities';
import { DescriptionDialogComponent } from '../movements/description-dialog/description-dialog.component';
import { ReconciliationDialogComponent, ReconciliationDialogData } from './reconciliation-dialog/reconciliation-dialog.component';

@Component({
  selector: 'app-import-page',
  templateUrl: './import-page.component.html',
  standalone: false
})
export class ImportPageComponent implements OnInit {
  accounts: Account[] = [];
  currencies: Currency[] = [];
  categories: Category[] = [];

  selectedAccount: Account | null = null;
  selectedFile: File | null = null;
  parsedMovements: ImportingMovement[] = [];
  previewColumns = ['exclude', 'date', 'description', 'payee', 'subcategory', 'amount', 'actions'];

  currencyWarnings: string[] = [];
  isRecentMovementsExpanded = false;

  movements: Movement[] = [];
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
    private recurrentTransactionService: RecurrentTransactionService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.accountService.getAccounts().subscribe(a => {
      this.accounts = a;
      if (this.accounts.length > 0 && !this.selectedAccount) {
        this.selectedAccount = this.accounts[0];
        this.loadMovementsForAccount();
        this.loadSnapshotsForAccount();
      }
    });
    this.currencyService.getCurrencies().subscribe(c => this.currencies = c);
    this.categoryService.getCategories().subscribe(c => this.categories = c);
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
    } else {
      this.movements = [];
    }
  }

  get movementsForSelectedAccount(): Movement[] {
    if (!this.selectedAccount) return [];
    
    // Filter movements for selected account
    const accountMovements = this.movements
      .filter(m => m.accountOrCardId === this.selectedAccount!.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    if (accountMovements.length === 0) return [];
    
    // Get the most recent movement date
    const lastMovementDate = new Date(accountMovements[0].date);
    const twoWeeksAgo = new Date(lastMovementDate);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    return accountMovements.filter(m => new Date(m.date) >= twoWeeksAgo);
  }

  onAccountSelect(): void {
    this.selectedFile = null;
    this.parsedMovements = [];
    this.currencyWarnings = [];
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

  onFileSelect(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedFile = file;
    this.parseExcelFile(file);
  }

  parseExcelFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });
      this.parsedMovements = this.convertToMovements(jsonData);
      this.markDuplicates();
      this.cdr.detectChanges();
    };
    reader.readAsArrayBuffer(file);
  }

  // Reuse resolver from dialog: map symbol/code to currency code
  private resolveCurrencyCode(raw: string | undefined): string | null {
    if (!raw) return null;
    const s = (raw || '').toString().trim();
    if (!s) return null;
    const bySymbol = this.currencies.find(c => c.symbol === s);
    if (bySymbol) return bySymbol.code;
    const maybeCode = s.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (maybeCode.length === 3) {
      const byCode = this.currencies.find(c => c.code.toUpperCase() === maybeCode);
      if (byCode) return byCode.code;
    }
    const direct = this.currencies.find(c => c.code.toUpperCase() === s.toUpperCase());
    if (direct) return direct.code;
    const containsSymbol = this.currencies.find(c => s.includes(c.symbol));
    if (containsSymbol) return containsSymbol.code;
    return null;
  }

  convertToMovements(data: any[]): ImportingMovement[] {
    if (!this.selectedAccount) return [];
    this.currencyWarnings = [];
    const accountCurrency = this.currencies.find(c => c.id === this.selectedAccount!.currencyId);
    const accountCurrencyCode = accountCurrency?.code || '';

    // Helper to minify/normalize description
    const minify = (desc: string) => desc.replace(/\s+/g, '').toLowerCase();
    // Get all subcategory rules from CategoryService
    const subcatRules = this.categoryService['rules$']?.value || [];

    return data.map((row, index) => {
      const importingMovement = new ImportingMovement();
      importingMovement.uuid = Utilities.generateUUID();
      importingMovement.accountOrCardId = this.selectedAccount!.id;
      importingMovement.date = this.parseDate(row['Fecha'] || row['Date'] || row['fecha']);
      importingMovement.bankDescription = row['Descripcion'] || row['Description'] || row['descripcion'] || '';
      importingMovement.payee = row['Payee'] || row['Payer'] || row['pagador'] || '';
      importingMovement.notes = row['Notes'] || row['Notas'] || '';

      let importedCurrencyRaw = row['Moneda'] || row['Currency'] || row['moneda'] || '';
      const resolvedCurrency = this.resolveCurrencyCode(importedCurrencyRaw) || '';

      if (this.selectedAccount!.type === AccountType.DEBIT) {
        if (resolvedCurrency && resolvedCurrency !== accountCurrencyCode) {
          this.currencyWarnings.push(`Row ${index + 2}: Currency ${importedCurrencyRaw} mapped to ${resolvedCurrency} and changed to ${accountCurrencyCode} (debit account requirement)`);
        }
        importingMovement.currency = accountCurrencyCode;
      } else {
        if (resolvedCurrency) {
          importingMovement.currency = resolvedCurrency;
          if (importedCurrencyRaw && resolvedCurrency !== importedCurrencyRaw) {
            this.currencyWarnings.push(`Row ${index + 2}: Currency ${importedCurrencyRaw} resolved to ${resolvedCurrency}`);
          }
        } else {
          importingMovement.currency = accountCurrencyCode;
          if (importedCurrencyRaw) this.currencyWarnings.push(`Row ${index + 2}: Unknown currency '${importedCurrencyRaw}', defaulted to ${accountCurrencyCode}`);
        }
      }

      importingMovement.amount = parseFloat(row['Monto'] || row['Amount'] || row['monto'] || '0');
      importingMovement.labels = [];
      importingMovement.operationNumber = row['Operation'] || row['Operacion'] || row['operation'] || null;

      let proposedCategoryId: string | null = null;
      let proposedSubcategoryId: string | null = null;
      let categorySource: 'rule' | 'recurrence' | null = null;

      const matchingRecurrence = this.findMatchingRecurrence(importingMovement);
      if (matchingRecurrence) {
        proposedCategoryId = matchingRecurrence.categoryId;
        proposedSubcategoryId = matchingRecurrence.subcategoryId;
        categorySource = 'recurrence';
      } else {
        // Apply subcategory rules on minified description
        const minifiedDesc = minify(importingMovement.bankDescription);
        const matchingRule = subcatRules.find(rule => {
          const rulePattern = minify(rule.pattern);
          switch (rule.ruleType) {
            case 'exact':
              return minifiedDesc === rulePattern;
            case 'startsWith':
              return minifiedDesc.startsWith(rulePattern);
            case 'contains':
              return minifiedDesc.includes(rulePattern);
            default:
              return false;
          }
        });
        if (matchingRule) {
          proposedSubcategoryId = matchingRule.categoryId;
          categorySource = 'rule';
          // Find parent category for the subcategory
          const subcategory = this.categories.find(c => c.id === matchingRule.categoryId);
          if (subcategory?.parentId) {
            proposedCategoryId = subcategory.parentId;
          }
        } else {
          // fallback to main category rules (non-minified)
          const ruleCategoryId = this.categoryService.applyCategoryRules(importingMovement.bankDescription);
          if (ruleCategoryId) {
            proposedCategoryId = ruleCategoryId;
            categorySource = 'rule';
          }
        }
      }

      importingMovement.categoryId = proposedCategoryId;
      importingMovement.subcategoryId = proposedSubcategoryId;
      importingMovement.proposedCategoryId = proposedCategoryId;
      importingMovement.proposedSubcategoryId = proposedSubcategoryId;
      importingMovement.categorySource = categorySource;

      return importingMovement;
    }).filter(m => m.bankDescription);
  }

  parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split(/[-\/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(dateStr);
  }

  markDuplicates(): void {
    if (!this.selectedAccount) return;
    const hasOperationNumber = this.parsedMovements.some(m => !!m.operationNumber);
    this.parsedMovements.forEach(item => {
      const duplicateCheck = this.movementService.checkDuplicate(item, hasOperationNumber);
      
      if (duplicateCheck.status === 'CONFIRMED') {
        item.duplicityStatus = DuplicityStatus.CONFIRMED;
        item.duplicateOfId = duplicateCheck.duplicateOfId;
        item.excluded = true;
      } else if (duplicateCheck.status === 'POTENTIAL') {
        item.duplicityStatus = DuplicityStatus.POTENTIAL;
        item.duplicateOfId = duplicateCheck.duplicateOfId;
        item.excluded = true; // Check by default but allow user to uncheck
      } else {
        item.duplicityStatus = DuplicityStatus.NONE;
        item.duplicateOfId = null;
        item.excluded = false;
      }
    });
  }

  findMatchingRecurrence(movement: Movement): any {
    const automaticRecurrences = this.recurrentTransactionService.getAutomaticTransactions();
    return automaticRecurrences.find(rt => {
      if (rt.accountOrCardId !== movement.accountOrCardId) return false;
      if (Math.abs(rt.amount - movement.amount) > 0.01) return false;
      if (rt.currency !== movement.currency) return false;
      const normalizeDesc = (desc: string) => desc.replace(/\s+/g, '').toLowerCase();
      const movementDesc = normalizeDesc(movement.bankDescription);
      const recurrenceDesc = normalizeDesc(rt.description);
      return movementDesc.includes(recurrenceDesc) || recurrenceDesc.includes(movementDesc);
    });
  }

  toggleExclude(item: ImportingMovement): void { item.excluded = !item.excluded; }

  onSubcategoryChange(item: ImportingMovement, subcategoryId: string | null): void {
    item.proposedSubcategoryId = subcategoryId;
    item.subcategoryId = subcategoryId;
    
    // Update category based on subcategory
    if (subcategoryId) {
      const subcategory = this.categories.find(c => c.id === subcategoryId);
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
      // Convert ImportingMovement to Movement by extracting only Movement properties
      // Use proposed category/subcategory as the final values
      const movement = new Movement();
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
      movement.operationNumber = importingMovement.operationNumber;
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

  private buildInterestAdjustmentMovement(delta: number, date: Date): Movement {
    const movement = new Movement();
    movement.accountOrCardId = this.selectedAccount!.id;
    movement.date = date;
    movement.payee = this.selectedAccount!.name;
    movement.bankDescription = 'Interest reconciliation adjustment';
    movement.additionalInfo = 'Auto-generated from snapshot reconciliation';
    movement.notes = `Delta adjustment based on owed snapshots. Delta: ${delta.toFixed(2)}`;
    movement.amount = delta;
    movement.currency = this.getSelectedAccountCurrencyCode();
    movement.type = delta < 0 ? MovementType.EXPENSE : MovementType.INCOME;
    movement.isStub = true;
    movement.adjustmentType = 'INTEREST_RECONCILIATION';
    movement.adjustmentContext = `snapshot:${this.selectedPreviousSnapshotId}->${this.currentSnapshotDate}`;

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

  private finishImport(movements: Movement[]): void {
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

  onCancel(): void { this.selectedFile = null; this.parsedMovements = []; this.currencyWarnings = []; }

  openDescriptionDialog(item: ImportingMovement): void {
    const dialogRef = this.dialog.open(DescriptionDialogComponent, {
      width: '500px',
      data: { additionalInfo: item.additionalInfo }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        item.additionalInfo = result;
      }
    });
  }

  updatePayee(item: ImportingMovement, newPayee: string): void {
    item.payee = newPayee;
  }

  getCurrencyDetails(currencyCode: string): { name: string; symbol: string } | null {
    const currency = this.currencies.find(c => c.code === currencyCode);
    return currency ? { name: currency.code, symbol: currency.symbol } : null;
  }

  isConfirmedDuplicate(item: ImportingMovement): boolean {
    return item.duplicityStatus === DuplicityStatus.CONFIRMED;
  }

  isPotentialDuplicate(item: ImportingMovement): boolean {
    return item.duplicityStatus === DuplicityStatus.POTENTIAL;
  }

  isDuplicate(item: ImportingMovement): boolean {
    return this.isConfirmedDuplicate(item) || this.isPotentialDuplicate(item);
  }

  getDuplicateMovement(item: ImportingMovement): Movement | null {
    if (!item.duplicateOfId) return null;
    return this.movements.find(m => m.id === item.duplicateOfId) || null;
  }

  getCategoryName(categoryId: string | null): string {
    if (!categoryId) return '';
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : '';
  }

  getSubcategoryName(subcategoryId: string | null): string {
    if (!subcategoryId) return '';
    const subcategory = this.categories.find(c => c.id === subcategoryId);
    return subcategory ? subcategory.name : '';
  }

  toggleRecentMovements(): void {
    this.isRecentMovementsExpanded = !this.isRecentMovementsExpanded;
  }
}
