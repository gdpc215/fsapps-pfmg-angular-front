import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CatalogRoutes as routectlg } from '../../application/app.routes.catalog';
import { SharedModule } from '../../shared/shared.module';
import { AccountDialogComponent } from './accounts/account-dialog/account-dialog.component';
import { AccountsComponent } from './accounts/accounts.component';
import { CheckpointDialogComponent } from './accounts/checkpoint-dialog/checkpoint-dialog.component';
import { CardDialogComponent } from './cards/card-dialog/card-dialog.component';
import { CardsComponent } from './cards/cards.component';
import { CategoriesComponent } from './categories/categories.component';
import { CategoryDialogComponent } from './categories/category-dialog/category-dialog.component';
import { RulesDialogComponent } from './categories/rules-dialog/rules-dialog.component';
import { CurrenciesComponent } from './currencies/currencies.component';
import { CurrencyDialogComponent } from './currencies/currency-dialog/currency-dialog.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CategorizeDialogComponent } from './movements/categorize-dialog/categorize-dialog.component';
import { ImportDialogComponent } from './movements/import-dialog/import-dialog.component';
import { MovementsComponent } from './movements/movements.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: routectlg.TRANSACTIONS_DASHBOARD },
  { path: routectlg.TRANSACTIONS_DASHBOARD, component: DashboardComponent },
  { path: routectlg.TRANSACTIONS_CURRENCIES, component: CurrenciesComponent },
  { path: routectlg.TRANSACTIONS_ACCOUNTS, component: AccountsComponent },
  { path: routectlg.TRANSACTIONS_CARDS, component: CardsComponent },
  { path: routectlg.TRANSACTIONS_MOVEMENTS, component: MovementsComponent },
  { path: routectlg.TRANSACTIONS_CATEGORIES, component: CategoriesComponent }
];

@NgModule({
  declarations: [
    DashboardComponent,
    CurrenciesComponent,
    CurrencyDialogComponent,
    AccountsComponent,
    AccountDialogComponent,
    CheckpointDialogComponent,
    CardsComponent,
    CardDialogComponent,
    MovementsComponent,
    ImportDialogComponent,
    CategorizeDialogComponent,
    CategoriesComponent,
    CategoryDialogComponent,
    RulesDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class TransactionsModule { }
