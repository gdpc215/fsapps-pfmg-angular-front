import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import * as XLSX from 'xlsx';
import { AccountService } from '../../../logic/services/account.service';
import { CategoryService } from '../../../logic/services/category.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { MovementService } from '../../../logic/services/movement.service';
import { RecurrentTransactionService } from '../../../logic/services/recurrent-transaction.service';
import { Account, AccountType } from '../../../logic/types/account';
import { Category } from '../../../logic/types/category';
import { Currency } from '../../../logic/types/currency';
import { DuplicityStatus, ImportingMovement } from '../../../logic/types/importing-movement';
import { Movement } from '../../../logic/types/movement';
import { Utilities } from '../../../logic/utilities';
import { DescriptionDialogComponent } from '../movements/description-dialog/description-dialog.component';

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

  movements: Movement[] = [];

  constructor(
    private accountService: AccountService,
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
      if (this.accounts.length > 0 && !this.selectedAccount) this.selectedAccount = this.accounts[0];
    });
    this.currencyService.getCurrencies().subscribe(c => this.currencies = c);
    this.categoryService.getCategories().subscribe(c => this.categories = c);
    this.movementService.getMovements().subscribe(m => this.movements = m);
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
        item.excluded = false; // Don't auto-exclude potential duplicates
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
    if (movementsToImport.length > 0) {
      this.movementService.addMovements(movementsToImport);
      // reset
      this.selectedFile = null;
      this.parsedMovements = [];
      this.currencyWarnings = [];
      alert(`${movementsToImport.length} movements imported`);
    }
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
}
