import { Component, OnInit } from '@angular/core';
import { CategoryService } from '../../../../logic/services/category.service';
import { Category, CategoryRule } from '../../../../logic/types/category';

interface RuleWithCategory {
  rule: CategoryRule;
  category: Category | undefined;
  subcategory: Category | undefined;
}

@Component({
  selector: 'app-category-rules',
  templateUrl: './category-rules.component.html',
  standalone: false
})
export class CategoryRulesComponent implements OnInit {
  categories: Category[] = [];
  rules: CategoryRule[] = [];
  rulesWithCategories: RuleWithCategory[] = [];
  displayedColumns = ['pattern', 'ruleType', 'category', 'subcategory'];

  constructor(private categoryService: CategoryService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.loadRules();
    });
  }

  loadRules(): void {
    this.categoryService.getRules().subscribe(rules => {
      this.rules = rules;
      this.buildRulesWithCategories();
    });
  }

  buildRulesWithCategories(): void {
    this.rulesWithCategories = this.rules.map(rule => {
      const category = this.categories.find(c => c.id === rule.categoryId);
      let subcategory: Category | undefined;

      // If category has a parent, it's actually a subcategory
      if (category?.parentId) {
        subcategory = category;
        const parentCategory = this.categories.find(c => c.id === category.parentId);
        return {
          rule,
          category: parentCategory,
          subcategory
        };
      }

      return {
        rule,
        category,
        subcategory: undefined
      };
    });
  }

  getRuleTypeLabel(ruleType: string): string {
    switch (ruleType) {
      case 'exact':
        return 'Exact Match';
      case 'startsWith':
        return 'Starts With';
      case 'contains':
        return 'Contains';
      default:
        return ruleType;
    }
  }

  deleteRule(rule: CategoryRule): void {
    if (confirm('Are you sure you want to delete this rule?')) {
      this.categoryService.deleteRule(rule.id);
    }
  }
}
