import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CatalogRoutes as routectlg } from '../../application/app.routes.catalog';
import { SharedModule } from '../../shared/shared.module';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CategorizeDialogComponent } from './movements/categorize-dialog/categorize-dialog.component';
import { ImportDialogComponent } from './movements/import-dialog/import-dialog.component';
import { MovementsComponent } from './movements/movements.component';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: routectlg.TRANSACTIONS_DASHBOARD },
  { path: routectlg.TRANSACTIONS_DASHBOARD, component: DashboardComponent },
  { path: routectlg.TRANSACTIONS_MOVEMENTS, component: MovementsComponent },
  { 
    path: routectlg.SETTINGS, 
    loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule)
  }
];

@NgModule({
  declarations: [
    DashboardComponent,
    MovementsComponent,
    ImportDialogComponent,
    CategorizeDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class TransactionsModule { }
