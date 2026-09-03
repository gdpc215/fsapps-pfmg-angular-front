import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { TransactionsComponent } from './pages/transactions/transactions.component';

const routes: Routes = [{ path: '', component: TransactionsComponent }];

@NgModule({
  declarations: [TransactionsComponent],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
    MatTableModule,
    MatButtonModule,
  ],
})
export class TransactionsModule {}
