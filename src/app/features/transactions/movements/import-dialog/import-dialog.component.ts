import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import * as XLSX from 'xlsx';
import { CategoryService } from '../../../../logic/services/category.service';
import { MovementService } from '../../../../logic/services/movement.service';
import { RecurrentTransactionService } from '../../../../logic/services/recurrent-transaction.service';
import { Account, AccountType } from '../../../../logic/types/account';
import { Category } from '../../../../logic/types/category';
import { Currency } from '../../../../logic/types/currency';
import { Movement } from '../../../../logic/types/movement';

interface MovementWithExclusion {
  movement: Movement;
  excluded: boolean; // true = will be excluded from import (checked)
  isDuplicate: boolean; // true = detected as duplicate
  proposedCategoryId: string | null; // Proposed category from rules or recurrences
  proposedSubcategoryId: string | null; // Proposed subcategory
  categorySource: 'rule' | 'recurrence' | null; // Where the category came from
}

@Component({
  selector: 'app-import-dialog',
  templateUrl: './import-dialog.component.html',
  standalone: false
})
export class ImportDialogComponent {
  selectedAccount: Account | null = null;
  selectedFile: File | null = null;
  parsedMovements: MovementWithExclusion[] = [];
  previewColumns = ['exclude', 'date', 'description', 'currency', 'amount', 'category', 'status'];
  categories: Category[] = [];

  constructor(
    private dialogRef: MatDialogRef<ImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { accounts: Account[], currencies: Currency[], categories: Category[] },
    private movementService: MovementService,
    private categoryService: CategoryService,
    private recurrentTransactionService: RecurrentTransactionService,
    private cdr: ChangeDetectorRef
  ) {
    // Pre-select first account if available
    if (this.data.accounts && this.data.accounts.length > 0) {
      this.selectedAccount = this.data.accounts[0];
    }
    this.categories = this.data.categories || [];
  }

  onAccountSelect(): void {
    this.selectedFile = null;
    this.parsedMovements = [];
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

      // Assume first sheet
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { raw: false });

      this.parsedMovements = this.convertToMovements(jsonData);
      this.markDuplicates();

      // Manually trigger change detection after async operation
      this.cdr.detectChanges();
    };

    reader.readAsArrayBuffer(file);
  }

  convertToMovements(data: any[]): MovementWithExclusion[] {
    if (!this.selectedAccount) return [];

    // Get the account's currency code
    const accountCurrency = this.data.currencies.find(c => c.id === this.selectedAccount!.currencyId);
    const accountCurrencyCode = accountCurrency?.code || '';

    // Helper: resolve imported currency string (symbol or code) to a currency code using available currencies
    const resolveCurrencyCode = (raw: string | undefined): string | null => {
      if (!raw) return null;
      const s = (raw || '').toString().trim();
      if (!s) return null;

      // If it's a common symbol like '$', 'S/', '€', match by symbol first
      const bySymbol = this.data.currencies.find(c => c.symbol === s);
      if (bySymbol) return bySymbol.code;

      // If the raw contains a symbol plus code like "$ USD" or "USD $", remove non-letters and try
      const maybeCode = s.replace(/[^A-Za-z]/g, '').toUpperCase();
      if (maybeCode.length === 3) {
        const byCode = this.data.currencies.find(c => c.code.toUpperCase() === maybeCode);
        if (byCode) return byCode.code;
      }

      // Try direct match to code (case-insensitive)
      const direct = this.data.currencies.find(c => c.code.toUpperCase() === s.toUpperCase());
      if (direct) return direct.code;

      // Last attempt: check if any currency's symbol is contained in the raw string
      const containsSymbol = this.data.currencies.find(c => s.includes(c.symbol));
      if (containsSymbol) return containsSymbol.code;

      return null;
    };

    return data.map((row, index) => {
      const movement = new Movement();
      movement.accountOrCardId = this.selectedAccount!.id;

      // Try to parse different date formats
      movement.date = this.parseDate(row['Fecha'] || row['Date'] || row['fecha']);
      movement.description = row['Descripcion'] || row['Description'] || row['descripcion'] || '';
      movement.payee = row['Payee'] || row['Payer'] || row['pagador'] || '';
      movement.notes = row['Notes'] || row['Notas'] || '';

      // Get currency from file (may be symbol like "$" or code like "USD")
      let importedCurrencyRaw = row['Moneda'] || row['Currency'] || row['moneda'] || '';
      const resolvedCurrency = resolveCurrencyCode(importedCurrencyRaw) || '';

      // Currency validation based on account type
      if (this.selectedAccount!.type === AccountType.DEBIT) {
        // For debit accounts, force the account's currency
        movement.currency = accountCurrencyCode;
      } else {
        // For credit accounts, if we resolved a currency code from symbol/code use it, otherwise default to account currency
        if (resolvedCurrency) {
          movement.currency = resolvedCurrency;
        } else {
          movement.currency = accountCurrencyCode;
        }
      }

      movement.amount = parseFloat(row['Monto'] || row['Amount'] || row['monto'] || '0');

      // Set defaults for new fields
      movement.labels = [];

      // Try to get operation number
      movement.operationNumber = row['Operation'] || row['Operacion'] || row['operation'] || null;

      // Determine proposed category
      let proposedCategoryId: string | null = null;
      let proposedSubcategoryId: string | null = null;
      let categorySource: 'rule' | 'recurrence' | null = null;

      // First, check if it matches an automatic recurrent transaction
      const matchingRecurrence = this.findMatchingRecurrence(movement);
      if (matchingRecurrence) {
        proposedCategoryId = matchingRecurrence.categoryId;
        proposedSubcategoryId = matchingRecurrence.subcategoryId;
        categorySource = 'recurrence';
      } else {
        // If no recurrence match, apply category rules
        const ruleCategoryId = this.categoryService.applyCategoryRules(movement.description);
        if (ruleCategoryId) {
          proposedCategoryId = ruleCategoryId;
          categorySource = 'rule';
        }
      }

      // Apply the proposed category to the movement
      movement.categoryId = proposedCategoryId;
      movement.subcategoryId = proposedSubcategoryId;

      return {
        movement,
        excluded: false, // Will be set to true for duplicates in markDuplicates()
        isDuplicate: false, // Will be set in markDuplicates()
        proposedCategoryId,
        proposedSubcategoryId,
        categorySource
      };
    }).filter(m => m.movement.description); // Filter out empty rows
  }

  parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();

    // Try different date formats
    // Format: yyyy-MM-dd or dd/MM/yyyy or MM/dd/yyyy
    const parts = dateStr.split(/[-\/]/);

    if (parts.length === 3) {
      // Assume yyyy-MM-dd if first part is 4 digits
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      } else {
        // Assume dd/MM/yyyy
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }

    return new Date(dateStr);
  }

  markDuplicates(): void {
    if (!this.selectedAccount) return;

    const hasOperationNumber = this.parsedMovements.some(m => !!m.movement.operationNumber);

    // Mark each movement as duplicate and auto-exclude duplicates
    this.parsedMovements.forEach(item => {
      item.isDuplicate = this.movementService.isDuplicate(item.movement, hasOperationNumber);
      item.excluded = item.isDuplicate; // Auto-check duplicates for exclusion
    });
  }

  findMatchingRecurrence(movement: Movement): any {
    const automaticRecurrences = this.recurrentTransactionService.getAutomaticTransactions();

    return automaticRecurrences.find(rt => {
      // Check if account matches
      if (rt.accountOrCardId !== movement.accountOrCardId) return false;

      // Check if amount matches
      if (Math.abs(rt.amount - movement.amount) > 0.01) return false;

      // Check if currency matches
      if (rt.currency !== movement.currency) return false;

      // Check if description contains the recurrence description (normalized)
      const normalizeDesc = (desc: string) => desc.replace(/\s+/g, '').toLowerCase();
      const movementDesc = normalizeDesc(movement.description);
      const recurrenceDesc = normalizeDesc(rt.description);

      return movementDesc.includes(recurrenceDesc) || recurrenceDesc.includes(movementDesc);
    });
  }

  getCategoryName(categoryId: string | null): string {
    if (!categoryId) return 'Uncategorized';
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  getCategorySourceLabel(source: 'rule' | 'recurrence' | null): string {
    if (source === 'rule') return 'From rule';
    if (source === 'recurrence') return 'From recurrence';
    return '';
  }

  toggleExclude(item: MovementWithExclusion): void {
    item.excluded = !item.excluded;
  }

  toggleAll(): void {
    const anyUnchecked = this.parsedMovements.some(m => !m.excluded);
    this.parsedMovements.forEach(m => m.excluded = anyUnchecked);
  }

  get movementsToImport(): number {
    return this.parsedMovements.filter(m => !m.excluded).length;
  }

  get duplicateCount(): number {
    return this.parsedMovements.filter(m => m.isDuplicate).length;
  }

  onImport(): void {
    if (!this.selectedAccount) {
      alert('Please select an account before importing');
      return;
    }

    const movementsToImport = this.parsedMovements
      .filter(m => !m.excluded)
      .map(m => m.movement);

    if (movementsToImport.length > 0) {
      this.movementService.addMovements(movementsToImport);
      this.dialogRef.close(true);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
