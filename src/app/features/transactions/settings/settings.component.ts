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
      description: 'Manage your currencies',
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
      title: 'Cards',
      description: 'Manage your payment cards',
      icon: 'credit_card',
      route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_CARDS}`
    },
    {
      title: 'Categories',
      description: 'Manage your transaction categories',
      icon: 'category',
      route: `/${CatalogRoutes.TRANSACTIONS}/${CatalogRoutes.SETTINGS}/${CatalogRoutes.SETTINGS_CATEGORIES}`
    }
  ];

  constructor(private router: Router) {}

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
