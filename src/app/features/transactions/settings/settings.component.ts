import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CatalogRoutes } from '../../../application/app.routes.catalog';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  standalone: false
})
export class SettingsComponent {
  settingsMenuItems = [
    {
      title: 'Currencies',
      description: 'Manage your currencies and conversion rates',
      icon: 'attach_money',
      route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_CURRENCIES}`
    },
    {
      title: 'Accounts',
      description: 'Manage your debit and credit accounts',
      icon: 'account_balance',
      route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_ACCOUNTS}`
    },
    {
      title: 'Categories',
      description: 'Manage your transaction categories and rules',
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
    }
  ];

  constructor(private router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
