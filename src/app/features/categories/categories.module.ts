import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { CategoryListComponent } from './pages/category-list/category-list.component';
import { CategoryRuleListComponent } from './pages/category-rule-list/category-rule-list.component';
import { DuplicationCollectionListComponent } from './pages/duplication-collection-list/duplication-collection-list.component';

const routes: Routes = [
  { path: '', component: CategoryListComponent },
  { path: 'rules', component: CategoryRuleListComponent },
  { path: 'duplications', component: DuplicationCollectionListComponent },
];

@NgModule({
  declarations: [
    CategoryListComponent,
    CategoryRuleListComponent,
    DuplicationCollectionListComponent,
  ],
  imports: [
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    RouterModule.forChild(routes),
    MatExpansionModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatTableModule,
  ],
})
export class CategoriesModule {}
