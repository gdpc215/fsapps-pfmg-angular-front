import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';

export interface CycleWindow {
  cycleStart: string;   // YYYY-MM-DD
  closingDate: string;  // YYYY-MM-DD
}

export interface ConciliationInput {
  cardId: string;
  intClosingDay: number;
  todayDate: string;
  currentBalance: number;
  previousClosingBalance: number;
  nonDeletedTransactions: Transaction[];  // ACTIVE + PENDING; service filters internally
}

export interface ConciliationResult {
  window: CycleWindow;
  openingBalance: number;
  cycleMovementsSum: number;
  amountA: number;
  postCloseMovementsSum: number;
  currentBalanceNegated: number;
  amountB: number;
  interestAmount: number;
}

@Injectable({ providedIn: 'root' })
export class ConciliationCalculatorService {

  calculate(input: ConciliationInput): ConciliationResult {
    const window       = this.buildCycleWindow(input.intClosingDay, input.todayDate);
    const openingBalance = input.previousClosingBalance;

    const cycleMovementsSum = input.nonDeletedTransactions
      .filter(t =>
        t.accountId === input.cardId &&
        t.strStatus === 'ACTIVE' &&             // confirmed only in cycle
        t.dateTransaction >= window.cycleStart &&
        t.dateTransaction <= window.closingDate
      )
      .reduce((s, t) => s + t.decAmountPen, 0);

    const amountA = openingBalance + cycleMovementsSum;

    const postCloseMovementsSum = input.nonDeletedTransactions
      .filter(t =>
        t.accountId === input.cardId &&
        t.strStatus !== 'DELETED' &&            // includes PENDING
        t.dateTransaction > window.closingDate &&
        t.dateTransaction <= input.todayDate
      )
      .reduce((s, t) => s + t.decAmountPen, 0);

    const currentBalanceNegated = -Math.abs(input.currentBalance);
    const amountB       = currentBalanceNegated - postCloseMovementsSum;
    const rawInterest   = amountB - amountA;
    const interestAmount = Math.abs(rawInterest) < 0.01 ? 0 : rawInterest;

    return { window, openingBalance, cycleMovementsSum, amountA,
             postCloseMovementsSum, currentBalanceNegated, amountB, interestAmount };
  }

  buildCycleWindow(intClosingDay: number, todayDate: string): CycleWindow {
    const today = new Date(todayDate + 'T12:00:00');
    const year  = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    const clampedDay    = Math.min(intClosingDay, this.daysInMonth(year, month));
    const closingDate   = new Date(year, month, clampedDay);

    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear  = month === 0 ? year - 1 : year;
    const prevClamp = Math.min(intClosingDay, this.daysInMonth(prevYear, prevMonth));
    const cycleStart = new Date(prevYear, prevMonth, prevClamp + 1);

    return {
      cycleStart:  this.formatDate(cycleStart),
      closingDate: this.formatDate(closingDate),
    };
  }

  daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
