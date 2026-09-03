import { Injectable } from '@angular/core';
import { RecurrentTransaction, RecurrenceFrequency } from '../models/recurrent-transaction.model';
import { RecurrentTransactionMatch } from '../models/recurrent-transaction-match.model';
import { Transaction } from '../models/transaction.model';

export interface AutomaticMatchResult {
  recurrent: RecurrentTransaction;
  transaction: Transaction;
  iterationKey: string;
}

@Injectable({ providedIn: 'root' })
export class RecurrentMatchingService {

  findAutomaticMatches(
    recurrents: RecurrentTransaction[],
    existingMatches: RecurrentTransactionMatch[],
    activeTransactions: Transaction[],
    todayDate: string
  ): AutomaticMatchResult[] {
    const results: AutomaticMatchResult[] = [];

    for (const recurrent of recurrents) {
      if (recurrent.strMatchMode !== 'AUTOMATIC') continue;

      const iterationKey = this.getCurrentIterationKey(recurrent.strFrequency, todayDate);

      // Once-per-iteration enforcement
      const alreadyMatched = existingMatches.some(
        m => m.recurrentTransactionId === recurrent.id &&
             m.strIterationKey === iterationKey
      );
      if (alreadyMatched) continue;

      const transaction = this.findAutomaticMatch(recurrent, activeTransactions, todayDate);
      if (transaction) {
        results.push({ recurrent, transaction, iterationKey });
      }
    }

    return results;
  }

  findAutomaticMatch(
    recurrent: RecurrentTransaction,
    activeTransactions: Transaction[],
    todayDate: string
  ): Transaction | undefined {
    const iterationKey = this.getCurrentIterationKey(recurrent.strFrequency, todayDate);
    const targetDate   = this.buildTargetDate(recurrent, iterationKey);

    const sign      = (recurrent.decApproxAmount ?? 0) < 0 ? -1 : 1;
    const absApprox = Math.abs(recurrent.decApproxAmount ?? 0);
    const range     = recurrent.decAmountRange ?? 0;
    const minAbs    = absApprox - range;
    const maxAbs    = absApprox + range;

    for (const t of activeTransactions) {
      if (t.accountId   !== recurrent.accountId)   continue;
      if (t.accountType !== recurrent.accountType) continue;
      if (recurrent.strCurrency != null && t.strCurrency !== recurrent.strCurrency) continue;

      const actualSign = t.decAmount < 0 ? -1 : 1;
      if (actualSign !== sign) continue;

      const absActual = Math.abs(t.decAmount);
      if (absActual < minAbs || absActual > maxAbs) continue;

      if (recurrent.strMatchString != null) {
        if (!t.strDescription.toLowerCase().includes(recurrent.strMatchString.toLowerCase())) continue;
      }

      if (targetDate != null && recurrent.intDayRange != null) {
        if (this.daysDiff(t.dateTransaction, targetDate) > recurrent.intDayRange) continue;
      }

      return t; // first match; stop
    }

    return undefined;
  }

  buildTargetDate(recurrent: RecurrentTransaction, iterationKey: string): string | undefined {
    if (recurrent.intApproxDay == null) return undefined;

    if (recurrent.strFrequency === 'MONTHLY') {
      const year  = parseInt(iterationKey.slice(0, 4), 10);
      const month = parseInt(iterationKey.slice(5, 7), 10) - 1; // 0-indexed
      const day   = Math.min(recurrent.intApproxDay, this.daysInMonth(year, month));
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    // YEARLY
    const year  = parseInt(iterationKey, 10);
    const month = (recurrent.intApproxMonth ?? 1) - 1; // 0-indexed
    const day   = Math.min(recurrent.intApproxDay, this.daysInMonth(year, month));
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  getCurrentIterationKey(frequency: RecurrenceFrequency, todayDate: string): string {
    return frequency === 'MONTHLY' ? todayDate.slice(0, 7) : todayDate.slice(0, 4);
  }

  getPreviousIterationKey(frequency: RecurrenceFrequency, currentKey: string): string {
    if (frequency === 'MONTHLY') {
      const [y, m] = currentKey.split('-').map(Number);
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      return `${prevY}-${String(prevM).padStart(2, '0')}`;
    }
    return String(Number(currentKey) - 1);
  }

  daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  private daysDiff(dateA: string, dateB: string): number {
    return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / 86_400_000;
  }
}
