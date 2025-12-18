import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Category, CategoryRule } from '../types/category';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class CategoryService extends BaseService {

  private categories$ = new BehaviorSubject<Category[]>([]);
  private rules$ = new BehaviorSubject<CategoryRule[]>([]);

  constructor() {
    super('CategoryService');
    this.loadFromCache();
  }

  getCategories(): Observable<Category[]> {
    return this.categories$.asObservable();
  }

  getCategoryById(id: string): Category | undefined {
    return this.categories$.value.find(c => c.id === id);
  }

  getTopLevelCategories(): Category[] {
    return this.categories$.value.filter(c => c.parentId === null);
  }

  getSubcategories(parentId: string): Category[] {
    return this.categories$.value.filter(c => c.parentId === parentId);
  }

  addCategory(category: Category): void {
    category.id = Utilities.generateUUID();
    const categories = [...this.categories$.value, category];
    this.saveCategoriesCache(categories);
  }

  updateCategory(category: Category): void {
    const categories = this.categories$.value.map(c =>
      c.id === category.id ? category : c
    );
    this.saveCategoriesCache(categories);
  }

  deleteCategory(id: string): void {
    // Also delete subcategories
    const categories = this.categories$.value.filter(c => 
      c.id !== id && c.parentId !== id
    );
    // Also delete rules for this category
    const rules = this.rules$.value.filter(r => r.categoryId !== id);
    this.saveCategoriesCache(categories);
    this.saveRulesCache(rules);
  }

  // Rules management
  getRules(): Observable<CategoryRule[]> {
    return this.rules$.asObservable();
  }

  getRulesByCategoryId(categoryId: string): CategoryRule[] {
    return this.rules$.value.filter(r => r.categoryId === categoryId);
  }

  addRule(rule: CategoryRule): void {
    rule.id = Utilities.generateUUID();
    const rules = [...this.rules$.value, rule];
    this.saveRulesCache(rules);
  }

  updateRule(rule: CategoryRule): void {
    const rules = this.rules$.value.map(r =>
      r.id === rule.id ? rule : r
    );
    this.saveRulesCache(rules);
  }

  deleteRule(id: string): void {
    const rules = this.rules$.value.filter(r => r.id !== id);
    this.saveRulesCache(rules);
  }

  /**
   * Apply auto-categorization rules to a description
   * Returns the category ID if a rule matches, null otherwise
   */
  applyCategoryRules(description: string): string | null {
    const lowerDesc = description.toLowerCase();
    
    for (const rule of this.rules$.value) {
      const lowerPattern = rule.pattern.toLowerCase();
      
      switch (rule.ruleType) {
        case 'exact':
          if (lowerDesc === lowerPattern) {
            return rule.categoryId;
          }
          break;
        case 'startsWith':
          if (lowerDesc.startsWith(lowerPattern)) {
            return rule.categoryId;
          }
          break;
        case 'contains':
          if (lowerDesc.includes(lowerPattern)) {
            return rule.categoryId;
          }
          break;
      }
    }
    
    return null;
  }

  private loadFromCache(): void {
    const cachedCategories = this.fetchFromLocalStorage<Category[]>(Constants.StorageTags.CATEGORIES);
    const cachedRules = this.fetchFromLocalStorage<CategoryRule[]>(Constants.StorageTags.CATEGORY_RULES);
    this.categories$.next(cachedCategories || []);
    this.rules$.next(cachedRules || []);
  }

  private saveCategoriesCache(categories: Category[]): void {
    this.storeInLocalStorage(categories, Constants.StorageTags.CATEGORIES);
    this.categories$.next(categories);
  }

  private saveRulesCache(rules: CategoryRule[]): void {
    this.storeInLocalStorage(rules, Constants.StorageTags.CATEGORY_RULES);
    this.rules$.next(rules);
  }
}
