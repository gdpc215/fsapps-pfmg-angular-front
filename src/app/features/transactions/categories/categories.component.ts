import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CategoryService } from '../../../logic/services/category.service';
import { Category } from '../../../logic/types/category';
import { CategoryDialogComponent } from './category-dialog/category-dialog.component';
import { RulesDialogComponent } from './rules-dialog/rules-dialog.component';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  standalone: false
})
export class CategoriesComponent implements OnInit {
  topLevelCategories: Category[] = [];
  allCategories: Category[] = [];

  constructor(
    private categoryService: CategoryService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe(categories => {
      this.allCategories = categories;
      this.topLevelCategories = categories.filter(c => c.parentId === null);
    });
  }

  getSubcategories(parentId: string): Category[] {
    return this.allCategories.filter(c => c.parentId === parentId);
  }

  openAddCategoryDialog(parentId: string | null): void {
    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      width: '500px',
      data: { category: null, parentId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.categoryService.addCategory(result);
      }
    });
  }

  openEditCategoryDialog(category: Category): void {
    const dialogRef = this.dialog.open(CategoryDialogComponent, {
      width: '500px',
      data: { category: { ...category }, parentId: category.parentId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.categoryService.updateCategory(result);
      }
    });
  }

  openRulesDialog(category: Category): void {
    this.dialog.open(RulesDialogComponent, {
      width: '700px',
      data: { category }
    });
  }

  deleteCategory(category: Category): void {
    const subcategories = this.getSubcategories(category.id);
    const message = subcategories.length > 0
      ? `Are you sure you want to delete ${category.name}? This will also delete ${subcategories.length} subcategories and all associated rules.`
      : `Are you sure you want to delete ${category.name}?`;

    if (confirm(message)) {
      this.categoryService.deleteCategory(category.id);
    }
  }
}
