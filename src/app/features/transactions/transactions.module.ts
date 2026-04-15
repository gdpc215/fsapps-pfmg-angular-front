import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CatalogRoutes as routectlg } from '../../application/app.routes.catalog';
import { SharedModule } from '../../shared/shared.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ImportPageComponent } from './import-movements/import-page.component';
import { ManualRecurrentsComponent } from './manual-recurrents/manual-recurrents.component';
import { CategorizeDialogComponent } from './movements/categorize-dialog/categorize-dialog.component';
import { DescriptionDialogComponent } from './movements/description-dialog/description-dialog.component';
import { ImportDialogComponent } from './movements/import-dialog/import-dialog.component';
import { MovementFormDialogComponent } from './movements/movement-form-dialog/movement-form-dialog.component';
import { MovementsComponent } from './movements/movements.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: routectlg.TRANSACTIONS_DASHBOARD },
  { path: routectlg.TRANSACTIONS_DASHBOARD, component: DashboardComponent },
  { path: routectlg.TRANSACTIONS_MOVEMENTS, component: MovementsComponent },
  { path: `${routectlg.TRANSACTIONS_MOVEMENTS}/${routectlg.TRANSACTIONS_MOVEMENTS_IMPORT}`, component: ImportPageComponent },
  { path: routectlg.TRANSACTIONS_MANUAL_RECURRENTS, component: ManualRecurrentsComponent },
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
    ImportDialogComponent,
    CategorizeDialogComponent,
    DescriptionDialogComponent,
    MovementFormDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class TransactionsModule { }
