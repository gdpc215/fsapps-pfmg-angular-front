import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveFormsModule } from '@angular/forms';
import { DebitAccountListComponent } from './pages/debit-account-list/debit-account-list.component';
import { DebitAccountFormComponent } from './pages/debit-account-form/debit-account-form.component';

const routes: Routes = [
  { path: '', component: DebitAccountListComponent },
  { path: 'new', component: DebitAccountFormComponent },
  { path: ':id/edit', component: DebitAccountFormComponent },
];

@NgModule({
  declarations: [DebitAccountListComponent, DebitAccountFormComponent],
  imports: [
    SharedModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatCardModule, MatFormFieldModule, MatInputModule, MatIconModule,
  ],
})
export class DebitAccountsModule {}
