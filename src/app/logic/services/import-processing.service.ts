import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { FinancialSource } from '../types/financial-source';
import { DuplicityStatus, ImportingTransaction } from '../types/importing-transaction';
import { Transaction, TransactionType } from '../types/transaction';
import { Utilities } from '../utilities';
import { CategoryService } from './category.service';
import { DuplicateCheckResult, DuplicateDetectionService } from './duplicate-detection.service';
import { RecurringEngineService } from './recurring-engine.service';
import { TransactionService } from './transaction.service';

export interface ImportPreviewResult {
  rows: ImportingTransaction[];
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
    private recurringService: RecurringEngineService
  ) {}

  async processFile(file: File, source: FinancialSource, exchangeRate?: number): Promise<ImportPreviewResult> {
    const rows = await this.parseFile(file);
    const validationErrors = this.validateRows(rows);

    if (validationErrors.length > 0) {
      return {
        rows: [],
        validationErrors,
        confirmedDuplicates: 0,
        potentialConflicts: 0
      };
    }

    const currentTransactions = this.transactionService.getBySource(source.id);
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
      validationErrors: [],
      confirmedDuplicates,
      potentialConflicts
    };
  }

  persistRows(rows: ImportingTransaction[]): void {
    const approved = rows
      .filter((row) => !row.excluded)
      .map((row) => {
        const tx = new Transaction();
        Object.assign(tx, row);
        tx.category = row.proposedCategoryId || undefined;
        tx.subcategory = row.proposedSubcategoryId || undefined;
        return tx;
      });

    if (approved.length) {
      this.transactionService.addTransactions(approved);
    }
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

  private enrichRow(row: any, source: FinancialSource, exchangeRate?: number): ImportingTransaction {
    const tx = new ImportingTransaction();
    tx.uuid = Utilities.generateUUID();
    tx.sourceId = source.id;
    tx.date = this.toIsoDate(row['Fecha'] ?? row['Date'] ?? row['fecha']);
    tx.description = String(row['Descripcion'] ?? row['Description'] ?? row['descripcion'] ?? '').trim();
    tx.normalizedDescription = tx.description.replace(/\s+/g, '').toLowerCase();
    tx.payee = String(row['Payee'] ?? row['Payer'] ?? row['pagador'] ?? '').trim();
    tx.notes = String(row['Notes'] ?? row['Notas'] ?? '').trim();
    tx.currency = (row['Moneda'] ?? row['Currency'] ?? row['moneda'] ?? source.currency ?? 'PEN').toString().toUpperCase() as 'PEN' | 'USD';
    tx.amount = parseFloat(row['Monto'] ?? row['Amount'] ?? row['monto'] ?? '0');
    tx.operationNumber = (row['Operation'] ?? row['Operacion'] ?? row['operation'] ?? null) as string | null;
    tx.type = tx.amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
    tx.exchangeRate = tx.currency === 'USD' ? exchangeRate : undefined;
    tx.amountPen = tx.currency === 'USD' && exchangeRate ? tx.amount * exchangeRate : tx.amount;

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
}
