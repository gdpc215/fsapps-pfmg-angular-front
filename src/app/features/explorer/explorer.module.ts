import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { TransactionExplorerComponent } from './pages/transaction-explorer/transaction-explorer.component';

const routes: Routes = [
  { path: '', component: TransactionExplorerComponent },
];

@NgModule({
  declarations: [TransactionExplorerComponent],
  imports: [
    SharedModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTableModule, MatIconModule, MatDividerModule,
  ],
})
export class ExplorerModule {}
