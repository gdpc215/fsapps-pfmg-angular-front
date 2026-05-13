import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogRoutes } from '../../../application/app.routes.catalog';
import { Constants } from '../../../logic/constants';
import { DuplicateDetectionRule } from '../../../logic/services/movement.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  standalone: false
})
export class SettingsComponent {
  settingsGroups = [
    {
      label: 'Setup',
      items: [
        {
          title: 'Accounts',
          description: 'Manage your debit and credit accounts',
          icon: 'account_balance',
          route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_ACCOUNTS}`
        },
        {
          title: 'Currencies',
          description: 'Manage your currencies and conversion rates',
          icon: 'attach_money',
          route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_CURRENCIES}`
        }
      ]
    },
    {
      label: 'Automation',
      items: [
        {
          title: 'Categories',
          description: 'Manage your transaction categories',
          icon: 'category',
          route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_CATEGORIES}`
        },
        {
          title: 'Category Rules',
          description: 'View all auto-categorization rules',
          icon: 'rule',
          route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_CATEGORY_RULES}`
        },
        {
          title: 'Recurrent Transactions',
          description: 'Set up automatic recurring payments and income',
          icon: 'event_repeat',
          route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_RECURRENT_TRANSACTIONS}`
        },
        {
          title: 'Duplicate Detection Rules',
          description: 'Manage rules for detecting duplicate transactions',
          icon: 'content_copy',
          route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_DUPLICATE_DETECTION_RULES}`
        }
      ]
    },
    {
      label: 'Planning',
      items: [
        {
          title: 'Savings Goals',
          description: 'Track progress towards your savings targets',
          icon: 'savings',
          route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_SAVINGS_GOALS}`
        }
      ]
    },
    {
      label: 'Data',
      items: [
        {
          title: 'Data Management',
          description: 'Export backup or import data from a JSON file',
          icon: 'cloud_download',
          route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_DATA_MANAGEMENT}`
        },
        {
          title: 'Clear Storages',
          description: 'Erase all or specific app data from local storage',
          icon: 'delete_forever',
          route: '/transactions/settings/clear-storage'
        }
      ]
    }
  ];

  // Keep flat list for any legacy usages
  get settingsMenuItems() {
    return this.settingsGroups.flatMap(g => g.items);
  }


  duplicateDetectionRules: DuplicateDetectionRule[] = [];

  constructor(private router: Router) {
    this.loadDuplicateDetectionRules();
  }

  loadDuplicateDetectionRules() {
    const rules = localStorage.getItem(Constants.StorageTags.DUPLICATE_DETECTION_RULES);
    this.duplicateDetectionRules = rules ? JSON.parse(rules) : [];
  }

  saveDuplicateDetectionRules(rules: DuplicateDetectionRule[]) {
    this.duplicateDetectionRules = rules;
    localStorage.setItem(Constants.StorageTags.DUPLICATE_DETECTION_RULES, JSON.stringify(rules));
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
