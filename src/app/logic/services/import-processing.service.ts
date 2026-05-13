import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Constants } from '../constants';
import { Account } from '../types/account';
import { Currency } from '../types/currency';
import { DuplicityStatus, ImportingTransaction } from '../types/importing-transaction';
import { Transaction, TransactionType } from '../types/transaction';
import { Utilities } from '../utilities';
import { CategoryService } from './category.service';
import { DuplicateCheckResult, DuplicateDetectionService } from './duplicate-detection.service';
import { RecurringEngineService } from './recurring-engine.service';
import { StorageService } from './storage.service';
import { TransactionService } from './transaction.service';

export interface ImportPreviewResult {
  rows: ImportingTransaction[];
  existingTransactions: Transaction[];
  validationErrors: string[];
  confirmedDuplicates: number;
  potentialConflicts: number;
}

@Injectable({ providedIn: 'root' })
export class ImportProcessingService {
  constructor(
    private categoryService: CategoryService,
    private transactionService: TransactionService,
    private duplicateDetectionService: DuplicateDetectionService,
    private recurringService: RecurringEngineService,
    private storageService: StorageService
  ) {}

  async processFile(file: File, source: Account, exchangeRate?: number): Promise<ImportPreviewResult> {
    const rows = await this.parseFile(file);
    const validationErrors = this.validateRows(rows);

    if (validationErrors.length > 0) {
      return {
        rows: [],
        existingTransactions: [],
        validationErrors,
        confirmedDuplicates: 0,
        potentialConflicts: 0
      };
    }

    const currentTransactions = this.transactionService.getBySource(source.id);

    // Load already-imported transactions within the same date window as the file
    const minDate = this.getMinDateFromRows(rows);
    const maxDate = this.getMaxDateFromRows(rows);
    const existingTransactions = this.getExistingTransactionsInRange(source.id, minDate, maxDate);

    const processedRows: ImportingTransaction[] = [];
    let confirmedDuplicates = 0;
    let potentialConflicts = 0;

    rows.forEach((row) => {
      const tx = this.enrichRow(row, source, exchangeRate);
      const duplicate = this.duplicateDetectionService.checkDuplicate(tx, currentTransactions);
      this.applyDuplicateStatus(tx, duplicate);

      if (tx.duplicityStatus === 'CONFIRMED') {
        confirmedDuplicates += 1;
      }
      if (tx.duplicityStatus === 'POTENTIAL') {
        potentialConflicts += 1;
      }

      const recurringMatch = this.recurringService.findMatches(tx);
      if (recurringMatch.matchedRule) {
        tx.recurringMatchId = recurringMatch.matchedRule.id;
        tx.categorySource = 'recurrence';
      }
      if (recurringMatch.conflicts.length > 0) {
        tx.recurringConflict = true;
        tx.recurringCandidates = recurringMatch.conflicts.map((rule) => rule.name);
      }

      processedRows.push(tx);
    });

    return {
      rows: processedRows,
      existingTransactions,
      validationErrors: [],
      confirmedDuplicates,
      potentialConflicts
    };
  }

  private parseFile(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(firstSheet, { raw: false }));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  private validateRows(rows: any[]): string[] {
    const errors: string[] = [];
    const requiredColumns = ['Fecha|Date|fecha', 'Descripcion|Description|descripcion', 'Monto|Amount|monto', 'Moneda|Currency|moneda'];

    if (!rows.length) {
      errors.push('The selected file has no rows.');
      return errors;
    }

    const firstRow = rows[0];
    requiredColumns.forEach((compositeKey) => {
      const options = compositeKey.split('|');
      const found = options.some((key) => Object.prototype.hasOwnProperty.call(firstRow, key));
      if (!found) {
        errors.push(`Missing required column (${compositeKey})`);
      }
    });

    rows.forEach((row, index) => {
      const amountRaw = row['Monto'] ?? row['Amount'] ?? row['monto'];
      const amount = parseFloat(amountRaw);
      if (Number.isNaN(amount)) {
        errors.push(`Row ${index + 2}: invalid amount '${amountRaw}'`);
      }

      const description = row['Descripcion'] ?? row['Description'] ?? row['descripcion'];
      if (!description || /[^\w\s\-.,/*#+()]/.test(String(description))) {
        errors.push(`Row ${index + 2}: invalid description`);
      }
    });

    return errors;
  }

  private enrichRow(row: any, source: Account, exchangeRate?: number): ImportingTransaction {
    const currencies = this.storageService.get<Currency[]>(Constants.StorageTags.CURRENCIES) || [];
    const sourceCurrencyCode = this.resolveSourceCurrencyCode(source, currencies);

    const tx = new ImportingTransaction();
    tx.uuid = Utilities.generateUUID();
    tx.sourceId = source.id;
    tx.date = this.toIsoDate(row['Fecha'] ?? row['Date'] ?? row['fecha']);
    tx.description = String(row['Descripcion'] ?? row['Description'] ?? row['descripcion'] ?? '').trim();
    tx.normalizedDescription = tx.description.replace(/\s+/g, '').toLowerCase();
    tx.payee = String(row['Payee'] ?? row['Payer'] ?? row['pagador'] ?? '').trim();
    tx.notes = String(row['Notes'] ?? row['Notas'] ?? '').trim();
    const rawCurrency = row['Moneda'] ?? row['Currency'] ?? row['moneda'] ?? sourceCurrencyCode;
    tx.currency = this.normalizeCurrencyCode(rawCurrency, sourceCurrencyCode, currencies);
    tx.amount = parseFloat(row['Monto'] ?? row['Amount'] ?? row['monto'] ?? '0');
    tx.operationNumber = (row['Operation'] ?? row['Operacion'] ?? row['operation'] ?? null) as string | null;
    tx.type = tx.amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
    const rate = this.resolvePenRate(tx.currency, exchangeRate, currencies);
    tx.exchangeRate = tx.currency === 'PEN' ? undefined : (rate ?? undefined);
    tx.amountPen = this.toPenAmount(tx.amount, tx.currency, rate);

    const categoryId = this.categoryService.applyCategoryRules(tx.description);
    tx.categoryId = categoryId;
    tx.proposedCategoryId = categoryId;
    tx.proposedSubcategoryId = null;

    return tx;
  }

  private applyDuplicateStatus(tx: ImportingTransaction, result: DuplicateCheckResult): void {
    tx.duplicateOfId = result.duplicateOfId;
    if (result.status === 'CONFIRMED') {
      tx.duplicityStatus = DuplicityStatus.CONFIRMED;
      tx.excluded = true;
      return;
    }
    if (result.status === 'POTENTIAL') {
      tx.duplicityStatus = DuplicityStatus.POTENTIAL;
      tx.excluded = true;
      return;
    }

    tx.duplicityStatus = DuplicityStatus.NONE;
    tx.excluded = false;
  }

  private resolvePenRate(currencyCode: string, explicitRate?: number, currencies?: Currency[]): number | null {
    if (currencyCode === 'PEN') {
      return 1;
    }

    if (Number.isFinite(explicitRate) && (explicitRate as number) > 0) {
      return explicitRate as number;
    }

    const configuredCurrencies = currencies || this.storageService.get<Currency[]>(Constants.StorageTags.CURRENCIES) || [];
    const currency = configuredCurrencies.find((item) => item.code?.toUpperCase() === currencyCode.toUpperCase());
    if (!currency) {
      return null;
    }

    return Number.isFinite(currency.conversionRate) && currency.conversionRate > 0
      ? currency.conversionRate
      : null;
  }

  private toPenAmount(amount: number, currencyCode: string, rate: number | null): number {
    if (currencyCode === 'PEN') {
      return amount;
    }

    return amount * (rate ?? 1);
  }

  private resolveSourceCurrencyCode(source: Account, currencies: Currency[]): string {
    const byId = currencies.find((item) => item.id === source.currencyId);
    if (byId?.code) {
      return byId.code.toUpperCase();
    }

    const byCode = currencies.find((item) => item.code?.toUpperCase() === String(source.currencyId || '').toUpperCase());
    if (byCode?.code) {
      return byCode.code.toUpperCase();
    }

    return 'PEN';
  }

  private normalizeCurrencyCode(rawValue: unknown, fallbackCode: string, currencies: Currency[]): string {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return fallbackCode;
    }

    const byCode = currencies.find((item) => item.code?.toUpperCase() === raw.toUpperCase());
    if (byCode?.code) {
      return byCode.code.toUpperCase();
    }

    const bySymbol = currencies.find((item) => item.symbol === raw);
    if (bySymbol?.code) {
      return bySymbol.code.toUpperCase();
    }

    const byId = currencies.find((item) => item.id === raw);
    if (byId?.code) {
      return byId.code.toUpperCase();
    }

    const extractedLetters = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (extractedLetters.length === 3) {
      const byLetters = currencies.find((item) => item.code?.toUpperCase() === extractedLetters);
      if (byLetters?.code) {
        return byLetters.code.toUpperCase();
      }
    }

    return raw.toUpperCase();
  }

  private toIsoDate(raw: string): string {
    const dateText = (raw || '').toString().trim();
    if (!dateText) {
      return new Date().toISOString().slice(0, 10);
    }
    const parts = dateText.split(/[-\/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return new Date(dateText).toISOString().slice(0, 10);
  }

  private getMinDateFromRows(rows: any[]): string {
    if (!rows || rows.length === 0) {
      return new Date().toISOString().slice(0, 10);
    }
    
    const dates = rows
      .map((row) => this.toIsoDate(row['Fecha'] ?? row['Date'] ?? row['fecha']))
      .filter((d) => !!d)
      .sort();
    
    return dates[0] || new Date().toISOString().slice(0, 10);
  }

  private getExistingTransactionsInRange(sourceId: string, minFileDate: string, maxFileDate: string): Transaction[] {
    const minDate = new Date(`${minFileDate}T00:00:00`);
    minDate.setDate(minDate.getDate() - 5);
    minDate.setHours(0, 0, 0, 0);
    const maxDate = new Date(`${maxFileDate}T00:00:00`);
    maxDate.setHours(23, 59, 59, 999);
    return this.transactionService.getInRange(sourceId, minDate, maxDate);
  }

  private getMaxDateFromRows(rows: any[]): string {
    if (!rows || rows.length === 0) {
      return new Date().toISOString().slice(0, 10);
    }
    const dates = rows
      .map((row) => this.toIsoDate(row['Fecha'] ?? row['Date'] ?? row['fecha']))
      .filter((d) => !!d)
      .sort();
    return dates[dates.length - 1] || new Date().toISOString().slice(0, 10);
  }

}
