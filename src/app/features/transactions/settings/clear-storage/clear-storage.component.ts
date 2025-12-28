import { Component } from '@angular/core';
import { Constants } from '../../../../logic/constants';

@Component({
  selector: 'app-clear-storage',
  templateUrl: './clear-storage.component.html',
  standalone: false
})
export class ClearStorageComponent {
  storageTags = [
    { key: Constants.StorageTags.MOVEMENTS, label: 'Movements' },
    { key: Constants.StorageTags.CATEGORIES, label: 'Categories' },
    { key: Constants.StorageTags.CATEGORY_RULES, label: 'Category Rules' },
    { key: Constants.StorageTags.ACCOUNTS, label: 'Accounts' },
    { key: Constants.StorageTags.CARDS, label: 'Cards' },
    { key: Constants.StorageTags.CURRENCIES, label: 'Currencies' },
    { key: Constants.StorageTags.RECURRENT_TRANSACTIONS, label: 'Recurrent Transactions' },
    { key: Constants.StorageTags.DUPLICATE_DETECTION_RULES, label: 'Duplicate Detection Rules' },
    { key: Constants.StorageTags.USER_OBJECT, label: 'User Object' }
  ];

  clearStorage(tag: string) {
    localStorage.removeItem(tag);
  }

  clearAll() {
    this.storageTags.forEach(item => localStorage.removeItem(item.key));
  }
}
