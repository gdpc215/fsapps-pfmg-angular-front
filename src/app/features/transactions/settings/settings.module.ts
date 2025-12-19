import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CatalogRoutes as routectlg } from '../../../application/app.routes.catalog';
import { SharedModule } from '../../../shared/shared.module';
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
import { SettingsComponent } from './settings.component';

const routes: Routes = [
  { path: '', component: SettingsComponent },
  { path: routectlg.SETTINGS_CURRENCIES, component: CurrenciesComponent },
  { path: routectlg.SETTINGS_ACCOUNTS, component: AccountsComponent },
  { path: routectlg.SETTINGS_CARDS, component: CardsComponent },
  { path: routectlg.SETTINGS_CATEGORIES, component: CategoriesComponent }
];

@NgModule({
  declarations: [
    SettingsComponent,
    CurrenciesComponent,
    CurrencyDialogComponent,
    AccountsComponent,
    AccountDialogComponent,
    CheckpointDialogComponent,
    CardsComponent,
    CardDialogComponent,
    CategoriesComponent,
    CategoryDialogComponent,
    RulesDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class SettingsModule { }
