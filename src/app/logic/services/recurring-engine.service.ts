import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { RecurringRule } from '../types/recurring-rule';
import { Transaction } from '../types/transaction';
import { StorageService } from './storage.service';

export interface RecurringMatchResult {
  matchedRule: RecurringRule | null;
  conflicts: RecurringRule[];
}

@Injectable({ providedIn: 'root' })
export class RecurringEngineService {
  private recurringRules$ = new BehaviorSubject<RecurringRule[]>([]);

  constructor(private storageService: StorageService) {
    this.load();
  }

  getRules(): Observable<RecurringRule[]> {
    return this.recurringRules$.asObservable();
  }

  getCurrentRules(): RecurringRule[] {
    return this.recurringRules$.value;
  }

  findMatches(tx: Transaction): RecurringMatchResult {
    const normalizedDesc = tx.normalizedDescription || (tx.description || '').replace(/\s+/g, '').toLowerCase();
    const candidates = this.recurringRules$.value.filter((rule) => {
      if (rule.sourceId !== tx.sourceId) {
        return false;
      }

      const normalizedRule = rule.matchString.replace(/\s+/g, '').toLowerCase();
      const descMatches = normalizedDesc.includes(normalizedRule);
      const toleranceAmount = Math.abs(rule.expectedAmount) * (rule.tolerance || 0.1);
      const amountMatches = Math.abs(Math.abs(tx.amount) - Math.abs(rule.expectedAmount)) <= toleranceAmount;
      return descMatches && amountMatches;
    });

    if (candidates.length === 0) {
      return { matchedRule: null, conflicts: [] };
    }

    if (candidates.length === 1) {
      return { matchedRule: candidates[0], conflicts: [] };
    }

    return { matchedRule: null, conflicts: candidates };
  }

  tryAutoTag(tx: Transaction): void {
    if (tx.isManualOverride) {
      return;
    }

    const matchResult = this.findMatches(tx);
    if (matchResult.matchedRule) {
      tx.recurringMatchId = matchResult.matchedRule.id;
      tx.category = tx.category || 'Recurring';
    }
  }

  private load(): void {
    const cached = this.storageService.get<RecurringRule[]>(Constants.StorageTags.RECURRING_RULES) || [];
    this.recurringRules$.next(cached);
  }
}
