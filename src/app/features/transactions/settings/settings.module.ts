import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CatalogRoutes as routectlg } from '../../../application/app.routes.catalog';
import { SharedModule } from '../../../shared/shared.module';
import { AccountDialogComponent } from './accounts/account-dialog/account-dialog.component';
import { AccountsComponent } from './accounts/accounts.component';
import { CheckpointDialogComponent } from './accounts/checkpoint-dialog/checkpoint-dialog.component';
import { SnapshotsDialogComponent } from './accounts/snapshots-dialog/snapshots-dialog.component';
import { CategoriesComponent } from './categories/categories.component';
import { CategoryDialogComponent } from './categories/category-dialog/category-dialog.component';
import { RulesDialogComponent } from './categories/rules-dialog/rules-dialog.component';
import { CategoryRulesComponent } from './category-rules/category-rules.component';
import { ClearStorageComponent } from './clear-storage/clear-storage.component';
import { CurrenciesComponent } from './currencies/currencies.component';
import { CurrencyDialogComponent } from './currencies/currency-dialog/currency-dialog.component';
import { DuplicateDetectionRulesDialogComponent } from './duplicate-detection-rules/duplicate-detection-rules-dialog/duplicate-detection-rules-dialog.component';
import { DuplicateDetectionRulesComponent } from './duplicate-detection-rules/duplicate-detection-rules.component';
import { RecurrentTransactionDialogComponent } from './recurrent-transactions/recurrent-transaction-dialog/recurrent-transaction-dialog.component';
import { RecurrentTransactionsComponent } from './recurrent-transactions/recurrent-transactions.component';
import { SettingsComponent } from './settings.component';

const routes: Routes = [
  { path: '', component: SettingsComponent },
  { path: routectlg.SETTINGS_CURRENCIES, component: CurrenciesComponent },
  { path: routectlg.SETTINGS_ACCOUNTS, component: AccountsComponent },
  { path: routectlg.SETTINGS_CATEGORIES, component: CategoriesComponent },
  { path: routectlg.SETTINGS_CATEGORY_RULES, component: CategoryRulesComponent },
  { path: routectlg.SETTINGS_RECURRENT_TRANSACTIONS, component: RecurrentTransactionsComponent },
  { path: routectlg.SETTINGS_DUPLICATE_DETECTION_RULES, component: DuplicateDetectionRulesComponent },
  { path: 'clear-storage', component: ClearStorageComponent }
];

@NgModule({
  declarations: [
    SettingsComponent,
    CurrenciesComponent,
    CurrencyDialogComponent,
    AccountsComponent,
    AccountDialogComponent,
    CheckpointDialogComponent,
    SnapshotsDialogComponent,
    CategoriesComponent,
    CategoryDialogComponent,
    RulesDialogComponent,
    CategoryRulesComponent,
    RecurrentTransactionsComponent,
    RecurrentTransactionDialogComponent,
    DuplicateDetectionRulesComponent,
    DuplicateDetectionRulesDialogComponent,
    ClearStorageComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class SettingsModule { }
