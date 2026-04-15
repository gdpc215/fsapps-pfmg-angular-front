import { Injectable } from '@angular/core';
import { Constants } from '../constants';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  }

  set<T>(key: string, value: T | null): void {
    localStorage.removeItem(key);
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }

  exportAll(): string {
    const state = {
      financialSources: this.get(Constants.StorageTags.FINANCIAL_SOURCES) || [],
      transactions: this.get(Constants.StorageTags.TRANSACTIONS) || [],
      snapshots: this.get(Constants.StorageTags.BALANCE_SNAPSHOTS) || [],
      recurringRules: this.get(Constants.StorageTags.RECURRING_RULES) || [],
      savingsGoals: this.get(Constants.StorageTags.SAVINGS_GOALS) || [],
      categories: this.get(Constants.StorageTags.CATEGORIES) || [],
      categoryRules: this.get(Constants.StorageTags.CATEGORY_RULES) || [],
      duplicateDetectionRules: this.get(Constants.StorageTags.DUPLICATE_DETECTION_RULES) || [],
      currencies: this.get(Constants.StorageTags.CURRENCIES) || []
    };

    return JSON.stringify(state, null, 2);
  }

  importAll(json: string): { success: boolean; errors: string[] } {
    const errors: string[] = [];
    try {
      const state = JSON.parse(json);
      const requiredKeys = [
        'financialSources', 'transactions', 'snapshots', 'recurringRules',
        'savingsGoals', 'categories', 'categoryRules', 'duplicateDetectionRules', 'currencies'
      ];

      requiredKeys.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(state, key)) {
          errors.push(`Missing key: ${key}`);
        }
      });

      if (errors.length > 0) {
        return { success: false, errors };
      }

      this.set(Constants.StorageTags.FINANCIAL_SOURCES, state.financialSources || []);
      this.set(Constants.StorageTags.TRANSACTIONS, state.transactions || []);
      this.set(Constants.StorageTags.BALANCE_SNAPSHOTS, state.snapshots || []);
      this.set(Constants.StorageTags.RECURRING_RULES, state.recurringRules || []);
      this.set(Constants.StorageTags.SAVINGS_GOALS, state.savingsGoals || []);
      this.set(Constants.StorageTags.CATEGORIES, state.categories || []);
      this.set(Constants.StorageTags.CATEGORY_RULES, state.categoryRules || []);
      this.set(Constants.StorageTags.DUPLICATE_DETECTION_RULES, state.duplicateDetectionRules || []);
      this.set(Constants.StorageTags.CURRENCIES, state.currencies || []);

      return { success: true, errors: [] };
    } catch {
      return { success: false, errors: ['Invalid JSON format'] };
    }
  }
}
