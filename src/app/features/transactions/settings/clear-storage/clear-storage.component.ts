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

  storageTags = [
    { key: Constants.StorageTags.TRANSACTIONS, label: 'Transactions' },
    { key: Constants.StorageTags.CATEGORIES, label: 'Categories' },
    { key: Constants.StorageTags.CATEGORY_RULES, label: 'Category Rules' },
    { key: Constants.StorageTags.FINANCIAL_SOURCES, label: 'Financial Sources' },
    { key: Constants.StorageTags.BALANCE_SNAPSHOTS, label: 'Snapshots' },
    { key: Constants.StorageTags.CURRENCIES, label: 'Currencies' },
    { key: Constants.StorageTags.RECURRING_RULES, label: 'Recurring Rules' },
    { key: Constants.StorageTags.SAVINGS_GOALS, label: 'Savings Goals' },
    { key: Constants.StorageTags.DUPLICATE_DETECTION_RULES, label: 'Duplicate Detection Rules' },
    { key: Constants.StorageTags.USER_OBJECT, label: 'User Object' }
  ];

  clearStorage(tag: string) {
    localStorage.removeItem(tag);
    this.snackBar.open('Cleared.', undefined, { duration: 2000 });
  }

  clearAll() {
    this.storageTags.forEach(item => localStorage.removeItem(item.key));
    this.snackBar.open('All storage cleared.', 'OK', { duration: 3000 });
  }
}
