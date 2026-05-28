import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { Category, Subcategory } from '../../../../core/models/category.model';

@Component({
  selector: 'app-category-list',
  standalone: false,
  templateUrl: './category-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryListComponent {
  categories$ = this.categoryService.categories$;
  subcategories$ = this.categoryService.subcategories$;

  newCategoryName = new FormControl('', [Validators.required]);

  editingCategoryId: string | null = null;
  editingCategoryName = '';
  editingSubcategoryId: string | null = null;
  editingSubcategoryName = '';
  newSubcategoryNames: Record<string, string> = {};

  constructor(
    private categoryService: CategoryService,
    private transactionService: TransactionService,
    private dialog: MatDialog,
    private snackbar: SnackbarService,
  ) {}

  addCategory(): void {
    if (this.newCategoryName.invalid) return;
    this.categoryService.saveCategory({ strName: this.newCategoryName.value! });
    this.newCategoryName.reset();
  }

  startEditCategory(cat: Category): void {
    this.editingCategoryId = cat.id;
    this.editingCategoryName = cat.strName;
  }

  saveEditCategory(cat: Category): void {
    if (!this.editingCategoryName.trim()) return;
    this.categoryService.saveCategory({ ...cat, strName: this.editingCategoryName.trim() });
    this.editingCategoryId = null;
  }

  cancelEditCategory(): void { this.editingCategoryId = null; }

  deleteCategory(cat: Category, subcategories: Subcategory[]): void {
    const count = subcategories.filter(s => s.categoryId === cat.id).length;
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Delete category?',
          message: `Deleting '${cat.strName}' will also remove ${count} subcategories and clear categories from all associated transactions.`,
          danger: true,
        },
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.categoryService.deleteCategory(cat.id, this.transactionService);
        this.snackbar.success('Category deleted.');
      }
    });
  }

  getSubcategories(categoryId: string, subcategories: Subcategory[]): Subcategory[] {
    return subcategories.filter(s => s.categoryId === categoryId);
  }

  addSubcategory(categoryId: string): void {
    const name = (this.newSubcategoryNames[categoryId] || '').trim();
    if (!name) return;
    this.categoryService.saveSubcategory({ categoryId, strName: name });
    this.newSubcategoryNames[categoryId] = '';
  }

  startEditSubcategory(sub: Subcategory): void {
    this.editingSubcategoryId = sub.id;
    this.editingSubcategoryName = sub.strName;
  }

  saveEditSubcategory(sub: Subcategory): void {
    if (!this.editingSubcategoryName.trim()) return;
    this.categoryService.saveSubcategory({ ...sub, strName: this.editingSubcategoryName.trim() });
    this.editingSubcategoryId = null;
  }

  cancelEditSubcategory(): void { this.editingSubcategoryId = null; }

  deleteSubcategory(sub: Subcategory): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Delete subcategory?',
          message: `Deleting '${sub.strName}' will clear its category from all associated transactions.`,
          danger: true,
        },
      }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.categoryService.deleteSubcategory(sub.id, this.transactionService);
        this.snackbar.success('Subcategory deleted.');
      }
    });
  }
}
