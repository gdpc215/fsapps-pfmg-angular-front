import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Constants } from '../../../../logic/constants';
import { StorageService } from '../../../../logic/services/storage.service';

@Component({
  selector: 'app-clear-storage',
  templateUrl: './clear-storage.component.html',
  standalone: false
})
export class ClearStorageComponent {
  constructor(
    private storageService: StorageService,
    private snackBar: MatSnackBar
  ) {}

  storageTags = this.buildStorageTags();

  private readonly legacyStorageTags = [
    'FINANCIAL_SOURCES',
    'BALANCE_SNAPSHOTS'
  ];

  clearStorage(tag: string) {
    this.storageService.set(tag, null);
    this.snackBar.open('Cleared.', undefined, { duration: 2000 });
  }

  clearAll() {
    this.storageTags.forEach(item => this.storageService.set(item.key, null));
    this.legacyStorageTags.forEach(tag => this.storageService.set(tag, null));
    this.snackBar.open('All storage cleared.', 'OK', { duration: 3000 });
  }

  private buildStorageTags(): Array<{ key: string; label: string }> {
    const labels: Record<string, string> = {
      USER_OBJECT: 'User Object',
      CURRENCIES: 'Currencies',
      ACCOUNTS: 'Accounts',
      TRANSACTIONS: 'Transactions',
      CARD_BALANCE_SNAPSHOTS: 'Card Balance Snapshots',
      RECURRING_RULES: 'Recurring Rules',
      SAVINGS_GOALS: 'Savings Goals',
      APP_STATE: 'App State',
      CATEGORIES: 'Categories',
      CATEGORY_RULES: 'Category Rules',
      RECURRENT_TRANSACTIONS: 'Recurrent Transactions',
      DUPLICATE_DETECTION_RULES: 'Duplicate Detection Rules'
    };

    return Object.entries(Constants.StorageTags)
      .filter(([, value]) => typeof value === 'string')
      .map(([name, key]) => ({
        key,
        label: labels[name] || name.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
}
