import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { RecurrentListComponent } from './pages/recurrent-list/recurrent-list.component';
import { RecurrentFormComponent } from './pages/recurrent-form/recurrent-form.component';
import { RecurrentDashboardComponent } from './pages/recurrent-dashboard/recurrent-dashboard.component';

const routes: Routes = [
  { path: '', component: RecurrentListComponent },
  { path: 'new', component: RecurrentFormComponent },
  { path: ':id/edit', component: RecurrentFormComponent },
  { path: 'dashboard', component: RecurrentDashboardComponent },
];

@NgModule({
  declarations: [RecurrentListComponent, RecurrentFormComponent, RecurrentDashboardComponent],
  imports: [
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatRadioModule, MatTableModule, MatChipsModule, MatIconModule, MatDividerModule,
  ],
})
export class RecurrentTransactionsModule {}
