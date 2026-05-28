import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ShellComponent } from '../layout/shell/shell.component';

const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'dashboard/cycle', pathMatch: 'full' },
      {
        path: 'credit-cards',
        loadChildren: () =>
          import('../features/credit-cards/credit-cards.module').then(m => m.CreditCardsModule),
      },
      {
        path: 'debit-accounts',
        loadChildren: () =>
          import('../features/debit-accounts/debit-accounts.module').then(m => m.DebitAccountsModule),
      },
      {
        path: 'import',
        loadChildren: () =>
          import('../features/import/import.module').then(m => m.ImportModule),
      },
      {
        path: 'categories',
        loadChildren: () =>
          import('../features/categories/categories.module').then(m => m.CategoriesModule),
      },
      {
        path: 'conciliation',
        loadChildren: () =>
          import('../features/conciliation/conciliation.module').then(m => m.ConciliationModule),
      },
      {
        path: 'recurrent-transactions',
        loadChildren: () =>
          import('../features/recurrent-transactions/recurrent-transactions.module').then(m => m.RecurrentTransactionsModule),
      },
      {
        path: 'explorer',
        loadChildren: () =>
          import('../features/explorer/explorer.module').then(m => m.ExplorerModule),
      },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('../features/dashboard/dashboard.module').then(m => m.DashboardModule),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('../features/settings/settings.module').then(m => m.SettingsModule),
      },
      {
        path: 'transactions',
        loadChildren: () =>
          import('../features/transactions/transactions.module').then(m => m.TransactionsModule),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutesModule {}
