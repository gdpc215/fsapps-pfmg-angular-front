import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { ConciliationFormComponent } from './pages/conciliation-form/conciliation-form.component';
import { ConciliationHistoryComponent } from './pages/conciliation-history/conciliation-history.component';

const routes: Routes = [
  { path: '', component: ConciliationFormComponent },
  { path: 'history', component: ConciliationHistoryComponent },
];

@NgModule({
  declarations: [ConciliationFormComponent, ConciliationHistoryComponent],
  imports: [
    SharedModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCardModule, MatDividerModule, MatTableModule, MatIconModule,
  ],
})
export class ConciliationModule {}
