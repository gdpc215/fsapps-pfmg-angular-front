import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Category } from '../../../../logic/types/category';
import { Transaction } from '../../../../logic/types/transaction';

@Component({
  selector: 'app-categorize-dialog',
  templateUrl: './categorize-dialog.component.html',
  standalone: false
})
export class CategorizeDialogComponent implements OnInit {
  form!: FormGroup;
  subcategories: Category[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CategorizeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      movement: Transaction, 
      categories: Category[],
      allCategories: Category[]
    }
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      categoryId: [this.data.movement.categoryId],
      subcategoryId: [this.data.movement.subcategoryId]
    });

    if (this.data.movement.categoryId) {
      this.loadSubcategories(this.data.movement.categoryId);
    }
  }

  onCategoryChange(): void {
    const categoryId = this.form.get('categoryId')?.value;
    this.form.patchValue({ subcategoryId: null });
    
    if (categoryId) {
      this.loadSubcategories(categoryId);
    } else {
      this.subcategories = [];
    }
  }

  loadSubcategories(parentId: string): void {
    this.subcategories = this.data.allCategories.filter(c => c.parentId === parentId);
  }

  onSave(): void {
    this.dialogRef.close({
      categoryId: this.form.value.categoryId,
      subcategoryId: this.form.value.subcategoryId
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
