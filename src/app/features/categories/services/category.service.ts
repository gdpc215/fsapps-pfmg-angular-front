import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Category, Subcategory } from '../../../core/models/category.model';
import { CategoryRule } from '../../../core/models/category-rule.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { TransactionService } from '../../transactions/services/transaction.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly _categories$    = new BehaviorSubject<Category[]>([]);
  private readonly _subcategories$ = new BehaviorSubject<Subcategory[]>([]);
  private readonly _rules$         = new BehaviorSubject<CategoryRule[]>([]);

  readonly categories$:    Observable<Category[]>    = this._categories$.asObservable();
  readonly subcategories$: Observable<Subcategory[]> = this._subcategories$.asObservable();
  readonly rules$:         Observable<CategoryRule[]> = this._rules$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getCategories(): Category[]       { return this._categories$.getValue(); }
  getSubcategories(): Subcategory[] { return this._subcategories$.getValue(); }
  getRules(): CategoryRule[]        { return this._rules$.getValue(); }

  getSubcategoriesByCategoryId(categoryId: string): Subcategory[] {
    return this.getSubcategories().filter(s => s.categoryId === categoryId);
  }

  saveCategory(cat: Partial<Category>): Category {
    return this.storage.save<Category>(STORAGE_KEYS.CATEGORIES, cat as Category);
  }

  saveSubcategory(sub: Partial<Subcategory>): Subcategory {
    return this.storage.save<Subcategory>(STORAGE_KEYS.SUBCATEGORIES, sub as Subcategory);
  }

  saveRule(rule: Partial<CategoryRule>): CategoryRule {
    const existing = this.getRules();
    const conflict = existing.find(r => r.intPriority === rule.intPriority && r.id !== rule.id);
    if (conflict) {
      throw new Error(`Priority ${rule.intPriority} is already used by rule "${conflict.strMatchString}"`);
    }
    return this.storage.save<CategoryRule>(STORAGE_KEYS.CATEGORY_RULES, rule as CategoryRule);
  }

  deleteCategory(id: string, transactionService: TransactionService): void {
    const subs = this.getSubcategoriesByCategoryId(id);
    for (const sub of subs) {
      this.deleteSubcategory(sub.id, transactionService);
    }
    this.storage.delete(STORAGE_KEYS.CATEGORIES, id);
  }

  deleteSubcategory(id: string, transactionService: TransactionService): void {
    transactionService.clearSubcategoryRef(id);
    this.storage.delete(STORAGE_KEYS.SUBCATEGORIES, id);
  }

  deleteRule(id: string): void {
    this.storage.delete(STORAGE_KEYS.CATEGORY_RULES, id);
  }

  saveAllRules(rules: CategoryRule[]): void {
    this.storage.saveAll<CategoryRule>(STORAGE_KEYS.CATEGORY_RULES, rules);
  }

  private refresh(): void {
    this._categories$.next(this.storage.getAll<Category>(STORAGE_KEYS.CATEGORIES));
    this._subcategories$.next(this.storage.getAll<Subcategory>(STORAGE_KEYS.SUBCATEGORIES));
    this._rules$.next(this.storage.getAll<CategoryRule>(STORAGE_KEYS.CATEGORY_RULES));
  }
}
