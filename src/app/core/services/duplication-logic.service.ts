import { Injectable } from '@angular/core';
import { RawImportRow } from '../models/import-batch.model';
import { Transaction, AccountType } from '../models/transaction.model';
import { DuplicationCollection } from '../models/duplication-collection.model';

export type DuplicationFlag = 'NONE' | 'AUTO_DUPLICATE' | 'POTENTIAL_DUPLICATE';

export interface AnnotatedImportRow {
  raw: RawImportRow;
  flag: DuplicationFlag;
  matchingTransaction?: Transaction;
  subcategoryId?: string;
  note?: string;
  pendingFlag?: boolean;
  checked: boolean;
}

@Injectable({ providedIn: 'root' })
export class DuplicationLogicService {

  annotate(
    incoming: RawImportRow[],
    existing: Transaction[],
    collections: DuplicationCollection[],
    accountId: string,
    accountType: AccountType,
    boolP2Enabled: boolean
  ): AnnotatedImportRow[] {
    // Pre-filter: only ACTIVE transactions for this specific account
    const activeForAccount = existing.filter(
      t => t.accountId === accountId && t.strStatus === 'ACTIVE'
    );
    return incoming.map(row =>
      this.annotateRow(row, activeForAccount, collections, accountType, boolP2Enabled)
    );
  }

  private annotateRow(
    row: RawImportRow,
    existing: Transaction[],
    collections: DuplicationCollection[],
    accountType: AccountType,
    boolP2Enabled: boolean
  ): AnnotatedImportRow {
    // D1: debit only
    if (accountType === 'DEBIT_ACCOUNT' && row.strOperationNumber) {
      const d1 = existing.find(t =>
        t.strOperationNumber === row.strOperationNumber &&
        t.dateTransaction    === row.dateTransaction
      );
      if (d1) return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: d1, checked: false };
    }

    // A1: exact match
    const a1 = existing.find(t =>
      t.dateTransaction === row.dateTransaction &&
      t.strDescription  === row.description &&
      t.strCurrency     === row.currency &&
      this.amountsMatch(t.decAmount, row.amount)
    );
    if (a1) return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: a1, checked: false };

    // A2: USD floating date
    if (row.currency === 'USD') {
      const a2 = existing.find(t =>
        t.strCurrency    === 'USD' &&
        t.strDescription === row.description &&
        this.amountsMatch(t.decAmount, row.amount) &&
        this.daysDiff(t.dateTransaction, row.dateTransaction) <= 3
      );
      if (a2) return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: a2, checked: false };
    }

    // P1: prefix + amount + date
    const desc10 = row.description.slice(0, 10).toLowerCase();
    const p1 = existing.find(t =>
      this.amountsMatch(t.decAmount, row.amount) &&
      t.strDescription.slice(0, 10).toLowerCase() === desc10 &&
      this.daysDiff(t.dateTransaction, row.dateTransaction) <= 3
    );
    if (p1) return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p1, checked: true };

    // P2: amount + date (opt-in)
    if (boolP2Enabled) {
      const p2 = existing.find(t =>
        this.amountsMatch(t.decAmount, row.amount) &&
        this.daysDiff(t.dateTransaction, row.dateTransaction) <= 3
      );
      if (p2) return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p2, checked: true };
    }

    // P3: collection-based
    for (const col of collections) {
      const inHit = col.strings.find(s => row.description.toLowerCase().includes(s.toLowerCase()));
      if (inHit) {
        const p3 = existing.find(t => {
          const exHit = col.strings.some(s => t.strDescription.toLowerCase().includes(s.toLowerCase()));
          return exHit &&
            this.amountsMatch(t.decAmount, row.amount) &&
            t.strCurrency === row.currency &&
            this.daysDiff(t.dateTransaction, row.dateTransaction) <= 3;
        });
        if (p3) return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p3, checked: true };
      }
    }

    return { raw: row, flag: 'NONE', checked: true };
  }

  private amountsMatch(a: number, b: number): boolean {
    return Math.abs(a - b) < 0.001;
  }

  private daysDiff(dateA: string, dateB: string): number {
    return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / 86_400_000;
  }
}
