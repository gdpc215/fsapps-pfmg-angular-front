import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Category } from '../../../../../logic/types/category';

@Component({
  selector: 'app-category-dialog',
  templateUrl: './category-dialog.component.html',
  standalone: false
})
export class CategoryDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category: Category | null, parentId: string | null }
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [this.data.category?.name || '', Validators.required]
    });
  }

  onSave(): void {
    if (this.form.valid) {
      const category = new Category();
      if (this.data.category) {
        category.id = this.data.category.id;
      }
      category.name = this.form.value.name;
      category.parentId = this.data.parentId;
      this.dialogRef.close(category);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
