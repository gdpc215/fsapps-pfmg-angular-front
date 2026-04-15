import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ErrorComponent } from '../features/error/error.component';
import { FrameComponent } from '../shared/_frame/frame.component';
import { CatalogRoutes as routectlg } from './app.routes.catalog';

const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: routectlg.APP },

  // Frame wraps the features
  {
    path: routectlg.APP,
    component: FrameComponent,
    loadChildren: () => import('../features/app/features.module').then(m => m.FeaturesModule)
  },

  // Transactions module
  {
    path: routectlg.TRANSACTIONS,
    component: FrameComponent,
    loadChildren: () => import('../features/transactions/transactions.module').then(m => m.TransactionsModule)
  },

  { path: routectlg.ERROR, component: ErrorComponent },
  { path: '**', redirectTo: routectlg.ERROR }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutesModule { }