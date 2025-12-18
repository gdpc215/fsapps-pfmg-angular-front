import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CategoryService } from '../../../../logic/services/category.service';
import { Category, CategoryRule } from '../../../../logic/types/category';

@Component({
  selector: 'app-rules-dialog',
  templateUrl: './rules-dialog.component.html',
  standalone: false
})
export class RulesDialogComponent implements OnInit {
  rules: CategoryRule[] = [];
  originalRules: CategoryRule[] = [];

  constructor(
    private dialogRef: MatDialogRef<RulesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { category: Category },
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.originalRules = this.categoryService.getRulesByCategoryId(this.data.category.id);
    this.rules = JSON.parse(JSON.stringify(this.originalRules)); // Deep copy
  }

  addRule(): void {
    const rule = new CategoryRule();
    rule.categoryId = this.data.category.id;
    this.rules.push(rule);
  }

  removeRule(index: number): void {
    this.rules.splice(index, 1);
  }

  onSave(): void {
    // Delete removed rules
    const removedRules = this.originalRules.filter(
      or => !this.rules.find(r => r.id === or.id)
    );
    removedRules.forEach(r => this.categoryService.deleteRule(r.id));

    // Add or update rules
    this.rules.forEach(rule => {
      if (!rule.pattern.trim()) return; // Skip empty patterns

      if (rule.id) {
        // Update existing
        this.categoryService.updateRule(rule);
      } else {
        // Add new
        this.categoryService.addRule(rule);
      }
    });

    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
