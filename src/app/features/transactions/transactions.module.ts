import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CatalogRoutes as routectlg } from '../../application/app.routes.catalog';
import { SharedModule } from '../../shared/shared.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImportPageComponent } from './import-movements/import-page.component';
import { ManualRecurrentsComponent } from './manual-recurrents/manual-recurrents.component';
import { CategorizeDialogComponent } from './movements/categorize-dialog/categorize-dialog.component';
import { DescriptionDialogComponent } from './movements/description-dialog/description-dialog.component';
import { MovementFormDialogComponent } from './movements/movement-form-dialog/movement-form-dialog.component';
import { MovementsComponent } from './movements/movements.component';
import { ReconciliationPageComponent } from './reconciliation/reconciliation-page.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: routectlg.TRANSACTIONS_DASHBOARD },
  { path: routectlg.TRANSACTIONS_DASHBOARD, component: DashboardComponent },
  { path: routectlg.TRANSACTIONS_MOVEMENTS, component: MovementsComponent },
  { path: `${routectlg.TRANSACTIONS_MOVEMENTS}/${routectlg.TRANSACTIONS_MOVEMENTS_IMPORT}`, component: ImportPageComponent },
  { path: routectlg.TRANSACTIONS_MANUAL_RECURRENTS, component: ManualRecurrentsComponent },
  { path: routectlg.TRANSACTIONS_RECONCILIATION, component: ReconciliationPageComponent },
  {
    path: routectlg.SETTINGS,
    loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule)
  }
];

@NgModule({
  declarations: [
    DashboardComponent,
    MovementsComponent,
    ManualRecurrentsComponent,
    CategorizeDialogComponent,
    DescriptionDialogComponent,
    MovementFormDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    ImportPageComponent,
    ReconciliationPageComponent
  ]
})
export class TransactionsModule { }
