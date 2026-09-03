import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { CategoryService } from '../../services/category.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CategoryRule } from '../../../../core/models/category-rule.model';
import { Category, Subcategory } from '../../../../core/models/category.model';

@Component({
  selector: 'app-category-rule-list',
  standalone: false,
  templateUrl: './category-rule-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryRuleListComponent {
  rules$ = this.categoryService.rules$;
  subcategories$ = this.categoryService.subcategories$;
  categories$ = this.categoryService.categories$;

  addForm = new FormGroup({
    strMatchType:   new FormControl<string>('CONTAINS', Validators.required),
    strMatchString: new FormControl('', Validators.required),
    subcategoryId:  new FormControl<string|null>(null, Validators.required),
  });

  matchTypes = ['STARTS_WITH', 'CONTAINS', 'ENDS_WITH', 'EQUALS'];

  constructor(
    private categoryService: CategoryService,
    private dialog: MatDialog,
    private snackbar: SnackbarService,
  ) {}

  getSubcategoriesByCategory(categoryId: string, subcategories: Subcategory[]): Subcategory[] {
    return subcategories.filter(s => s.categoryId === categoryId);
  }

  resolveSubcategoryLabel(subcategoryId: string, subcategories: Subcategory[], categories: Category[]): string {
    const sub = subcategories.find(s => s.id === subcategoryId);
    if (!sub) return subcategoryId;
    const cat = categories.find(c => c.id === sub.categoryId);
    return `${cat?.strName ?? '?'} → ${sub.strName}`;
  }

  addRule(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    const rules = this.categoryService.getRules();
    const maxPriority = rules.length ? Math.max(...rules.map(r => r.intPriority)) : 0;
    try {
      this.categoryService.saveRule({
        strMatchType: this.addForm.value.strMatchType as any,
        strMatchString: this.addForm.value.strMatchString!,
        subcategoryId: this.addForm.value.subcategoryId!,
        intPriority: maxPriority + 1,
      });
      this.addForm.reset({ strMatchType: 'CONTAINS' });
      this.snackbar.success('Rule added.');
    } catch (e: any) {
      this.snackbar.error(e.message);
    }
  }

  deleteRule(rule: CategoryRule): void {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { data: { title: 'Delete rule?', message: `Remove rule "${rule.strMatchString}"?`, danger: true } }
    );
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.categoryService.deleteRule(rule.id);
        this.snackbar.success('Rule deleted.');
      }
    });
  }

  onDrop(event: CdkDragDrop<CategoryRule[]>): void {
    const rules = [...this.categoryService.getRules()].sort((a, b) => a.intPriority - b.intPriority);
    moveItemInArray(rules, event.previousIndex, event.currentIndex);
    const reordered = rules.map((r, idx) => ({ ...r, intPriority: idx + 1 }));
    this.categoryService.saveAllRules(reordered);
  }

  moveUp(index: number): void {
    if (index === 0) return;
    const rules = [...this.categoryService.getRules()].sort((a, b) => a.intPriority - b.intPriority);
    moveItemInArray(rules, index, index - 1);
    this.categoryService.saveAllRules(rules.map((r, i) => ({ ...r, intPriority: i + 1 })));
  }

  moveDown(rules: CategoryRule[], index: number): void {
    if (index >= rules.length - 1) return;
    const sorted = [...rules].sort((a, b) => a.intPriority - b.intPriority);
    moveItemInArray(sorted, index, index + 1);
    this.categoryService.saveAllRules(sorted.map((r, i) => ({ ...r, intPriority: i + 1 })));
  }
}
