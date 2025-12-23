import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Movement } from '../types/movement';
import { ExecutionMode, RecurrenceType, RecurrentTransaction } from '../types/recurrent-transaction';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class RecurrentTransactionService extends BaseService {

  private recurrentTransactions$ = new BehaviorSubject<RecurrentTransaction[]>([]);

  constructor() {
    super('RecurrentTransactionService');
    this.loadFromCache();
  }

  getRecurrentTransactions(): Observable<RecurrentTransaction[]> {
    return this.recurrentTransactions$.asObservable();
  }

  addRecurrentTransaction(recurrentTransaction: RecurrentTransaction): void {
    recurrentTransaction.id = Utilities.generateUUID();
    recurrentTransaction.nextExecution = this.calculateNextExecution(recurrentTransaction);
    const recurrentTransactions = [...this.recurrentTransactions$.value, recurrentTransaction];
    this.saveToCache(recurrentTransactions);
  }

  updateRecurrentTransaction(recurrentTransaction: RecurrentTransaction): void {
    recurrentTransaction.nextExecution = this.calculateNextExecution(recurrentTransaction);
    const recurrentTransactions = this.recurrentTransactions$.value.map(rt =>
      rt.id === recurrentTransaction.id ? recurrentTransaction : rt
    );
    this.saveToCache(recurrentTransactions);
  }

  deleteRecurrentTransaction(id: string): void {
    const recurrentTransactions = this.recurrentTransactions$.value.filter(rt => rt.id !== id);
    this.saveToCache(recurrentTransactions);
  }

  toggleActive(id: string): void {
    const recurrentTransactions = this.recurrentTransactions$.value.map(rt =>
      rt.id === id ? { ...rt, active: !rt.active } : rt
    );
    this.saveToCache(recurrentTransactions);
  }

  /**
   * Get all manual recurrent transactions that are due for execution
   */
  getDueManualTransactions(): RecurrentTransaction[] {
    const now = new Date();
    return this.recurrentTransactions$.value.filter(rt => {
      if (!rt.active || rt.executionMode !== ExecutionMode.MANUAL || !rt.nextExecution) return false;
      
      // Check if currently skipped
      if (rt.skippedUntil && rt.skippedUntil > now) return false;
      
      // Check if due (past nextExecution but within max days)
      if (rt.nextExecution > now) return false;
      
      // Check if past max execution window
      const maxDays = rt.maxDaysToExecute || 30;
      const maxDate = new Date(rt.nextExecution);
      maxDate.setDate(maxDate.getDate() + maxDays);
      
      return now <= maxDate;
    });
  }

  /**
   * Get all automatic recurrent transactions
   */
  getAutomaticTransactions(): RecurrentTransaction[] {
    return this.recurrentTransactions$.value.filter(rt => 
      rt.active && rt.executionMode === ExecutionMode.AUTOMATIC
    );
  }

  /**
   * Get all recurrent transactions that are due for execution (legacy support)
   */
  getDueTransactions(): RecurrentTransaction[] {
    return this.getDueManualTransactions();
  }

  /**
   * Mark a recurrent transaction as executed and calculate next execution date
   */
  markAsExecuted(id: string): void {
    const recurrentTransactions = this.recurrentTransactions$.value.map(rt => {
      if (rt.id === id) {
        const updatedRt = {
          ...rt,
          lastExecuted: new Date(),
          nextExecution: this.calculateNextExecution(rt, new Date()),
          skippedUntil: null // Clear any skip when executed
        };
        return updatedRt;
      }
      return rt;
    });
    this.saveToCache(recurrentTransactions);
  }

  /**
   * Skip the next occurrence of a recurrent transaction
   * Sets skippedUntil to the date after the next scheduled occurrence
   */
  skipNextOccurrence(id: string): void {
    const recurrentTransactions = this.recurrentTransactions$.value.map(rt => {
      if (rt.id === id && rt.nextExecution) {
        // Calculate when the skip should end (after the current period)
        const skipUntil = this.calculateNextExecution(rt, rt.nextExecution);
        return {
          ...rt,
          skippedUntil: skipUntil
        };
      }
      return rt;
    });
    this.saveToCache(recurrentTransactions);
  }

  /**
   * Get time remaining info for a recurrent transaction
   */
  getTimeRemaining(rt: RecurrentTransaction): { days: number; hours: number; minutes: number; isOverdue: boolean; isPastMax: boolean } {
    if (!rt.nextExecution) {
      return { days: 0, hours: 0, minutes: 0, isOverdue: false, isPastMax: false };
    }

    const now = new Date();
    const nextExec = new Date(rt.nextExecution);
    const diffMs = nextExec.getTime() - now.getTime();
    
    const isOverdue = diffMs < 0;
    
    // Check if past max execution window
    let isPastMax = false;
    if (isOverdue && rt.executionMode === ExecutionMode.MANUAL) {
      const maxDays = rt.maxDaysToExecute || 30;
      const maxDate = new Date(nextExec);
      maxDate.setDate(maxDate.getDate() + maxDays);
      isPastMax = now > maxDate;
    }
    
    const absDiffMs = Math.abs(diffMs);
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes, isOverdue, isPastMax };
  }

  /**
   * Convert a recurrent transaction to a movement
   */
  toMovement(recurrentTransaction: RecurrentTransaction): Movement {
    const movement = new Movement();
    movement.type = recurrentTransaction.type;
    movement.accountOrCardId = recurrentTransaction.accountOrCardId;
    movement.date = new Date();
    movement.payee = recurrentTransaction.payee;
    movement.description = recurrentTransaction.description;
    movement.notes = recurrentTransaction.notes;
    movement.currency = recurrentTransaction.currency;
    movement.amount = recurrentTransaction.amount;
    movement.categoryId = recurrentTransaction.categoryId;
    movement.subcategoryId = recurrentTransaction.subcategoryId;
    movement.labels = [...recurrentTransaction.labels];
    movement.targetAccountOrCardId = recurrentTransaction.targetAccountOrCardId;
    return movement;
  }

  /**
   * Calculate the next execution date based on recurrence pattern
   */
  private calculateNextExecution(recurrentTransaction: RecurrentTransaction, fromDate?: Date): Date {
    const baseDate = fromDate || new Date();
    const nextDate = new Date(baseDate);

    if (recurrentTransaction.recurrenceType === RecurrenceType.DAY_OF_MONTH) {
      // Set to the specified day of the current month
      const targetDay = recurrentTransaction.dayOfMonth || 1;
      nextDate.setDate(targetDay);
      nextDate.setHours(0, 0, 0, 0);
      
      // If we're past that day this month, move to next month
      if (nextDate <= baseDate) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      }
    } else if (recurrentTransaction.recurrenceType === RecurrenceType.DAY_OF_YEAR) {
      // Set to the specified month and day
      const targetMonth = (recurrentTransaction.month || 1) - 1; // 0-indexed
      const targetDay = recurrentTransaction.dayOfYear || 1;
      
      nextDate.setMonth(targetMonth);
      nextDate.setDate(targetDay);
      nextDate.setHours(0, 0, 0, 0);
      
      // If we're past that date this year, move to next year
      if (nextDate <= baseDate) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    }

    return nextDate;
  }

  private loadFromCache(): void {
    const cached = this.fetchFromLocalStorage<RecurrentTransaction[]>(Constants.StorageTags.RECURRENT_TRANSACTIONS);
    // Parse dates from string format and set defaults for new fields
    const recurrentTransactions = (cached || []).map(rt => ({
      ...rt,
      executionMode: rt.executionMode || ExecutionMode.MANUAL,
      maxDaysToExecute: rt.maxDaysToExecute || 30,
      lastExecuted: rt.lastExecuted ? new Date(rt.lastExecuted) : null,
      nextExecution: rt.nextExecution ? new Date(rt.nextExecution) : null,
      skippedUntil: rt.skippedUntil ? new Date(rt.skippedUntil) : null
    }));
    this.recurrentTransactions$.next(recurrentTransactions);
  }

  private saveToCache(recurrentTransactions: RecurrentTransaction[]): void {
    this.storeInLocalStorage(recurrentTransactions, Constants.StorageTags.RECURRENT_TRANSACTIONS);
    this.recurrentTransactions$.next(recurrentTransactions);
  }
}
