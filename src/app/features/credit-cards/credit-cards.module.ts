import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ReactiveFormsModule } from '@angular/forms';
import { CardListComponent } from './pages/card-list/card-list.component';
import { CardFormComponent } from './pages/card-form/card-form.component';

const routes: Routes = [
  { path: '', component: CardListComponent },
  { path: 'new', component: CardFormComponent },
  { path: ':id/edit', component: CardFormComponent },
];

@NgModule({
  declarations: [CardListComponent, CardFormComponent],
  imports: [
    SharedModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatCardModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTableModule,
  ],
})
export class CreditCardsModule {}
