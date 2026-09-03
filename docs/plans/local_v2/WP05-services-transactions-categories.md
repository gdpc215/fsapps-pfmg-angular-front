# WP05 — Feature Services: Transactions, Categories & Supporting Services

**Depends on:** WP01  
**Spec:** DESIGN_LOCAL_v5.md §6.2, §6.4, §6.5, §6.6, §6.8

---

## Goal

Implement five feature services: `TransactionService`, `CategoryService`, `DuplicationCollectionService`, `RecurrentTransactionService`, and `ConciliationService`. All follow the same BehaviorSubject + `storage.changes$` subscription pattern from WP04.

---

## Step 1 — `TransactionService`

File: `src/app/features/transactions/services/transaction.service.ts`

Copy from DESIGN_LOCAL_v5.md §6.2. Key methods beyond the basic pattern:

- `getActive()` — filter `strStatus === 'ACTIVE'`
- `getNonDeleted()` — filter `strStatus !== 'DELETED'` (includes PENDING)
- `getByAccount(accountId)` — all statuses
- `getActiveByCardAndDateRange(cardId, from, to)` — used by conciliation preview
- `saveMany(transactions)` — batch-inserts without triggering `changes$` on every item; writes once at the end via `storage.saveAll()`
- `softDelete(id)` — sets `strStatus = 'DELETED'`, preserves all other fields
- `clearSubcategoryRef(subcategoryId)` — bulk-updates all transactions referencing the subcategoryId to set it `undefined`

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Transaction } from '../../../core/models/transaction.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly _transactions$ = new BehaviorSubject<Transaction[]>([]);
  readonly transactions$: Observable<Transaction[]> = this._transactions$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): Transaction[] { return this._transactions$.getValue(); }

  getActive(): Transaction[] {
    return this.getAll().filter(t => t.strStatus === 'ACTIVE');
  }

  getNonDeleted(): Transaction[] {
    return this.getAll().filter(t => t.strStatus !== 'DELETED');
  }

  getByAccount(accountId: string): Transaction[] {
    return this.getAll().filter(t => t.accountId === accountId);
  }

  getActiveByCardAndDateRange(cardId: string, from: string, to: string): Transaction[] {
    return this.getActive().filter(
      t => t.accountId === cardId && t.dateTransaction >= from && t.dateTransaction <= to
    );
  }

  save(transaction: Partial<Transaction>): Transaction {
    const record = { strStatus: 'ACTIVE' as const, ...transaction } as Transaction;
    return this.storage.save<Transaction>(STORAGE_KEYS.TRANSACTIONS, record);
  }

  saveMany(transactions: Partial<Transaction>[]): Transaction[] {
    const all = this.storage.getAll<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const now = new Date().toISOString();
    const saved: Transaction[] = transactions.map(t => ({
      strStatus: 'ACTIVE' as const,
      ...t,
      id: crypto.randomUUID(),
      dateCreation: now,
      dateModification: now,
    } as Transaction));
    this.storage.saveAll<Transaction>(STORAGE_KEYS.TRANSACTIONS, [...all, ...saved]);
    return saved;
  }

  softDelete(id: string): void {
    const t = this.getAll().find(x => x.id === id);
    if (t) this.storage.save<Transaction>(STORAGE_KEYS.TRANSACTIONS, { ...t, strStatus: 'DELETED' });
  }

  clearSubcategoryRef(subcategoryId: string): void {
    const all = this.getAll();
    const updated = all.map(t =>
      t.subcategoryId === subcategoryId ? { ...t, subcategoryId: undefined } : t
    );
    this.storage.saveAll<Transaction>(STORAGE_KEYS.TRANSACTIONS, updated);
  }

  private refresh(): void {
    this._transactions$.next(this.storage.getAll<Transaction>(STORAGE_KEYS.TRANSACTIONS));
  }
}
```

---

## Step 2 — `CategoryService`

File: `src/app/features/categories/services/category.service.ts`

Copy from DESIGN_LOCAL_v5.md §6.4. Manages three storage keys: categories, subcategories, and category rules.

Key behaviors:
- `saveRule()` rejects (throws) if another rule has the same `intPriority`.
- `deleteSubcategory()` calls `transactionService.clearSubcategoryRef()` before deleting the subcategory record.
- `deleteCategory()` cascade-deletes all child subcategories first.

```typescript
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

  /** Replace the entire rules array — used by drag-to-reorder priority reassignment. */
  saveAllRules(rules: CategoryRule[]): void {
    this.storage.saveAll<CategoryRule>(STORAGE_KEYS.CATEGORY_RULES, rules);
  }

  private refresh(): void {
    this._categories$.next(this.storage.getAll<Category>(STORAGE_KEYS.CATEGORIES));
    this._subcategories$.next(this.storage.getAll<Subcategory>(STORAGE_KEYS.SUBCATEGORIES));
    this._rules$.next(this.storage.getAll<CategoryRule>(STORAGE_KEYS.CATEGORY_RULES));
  }
}
```

---

## Step 3 — `DuplicationCollectionService`

File: `src/app/features/categories/services/duplication-collection.service.ts`

Copy from DESIGN_LOCAL_v5.md §6.6. Simple CRUD wrapping one storage key.

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DuplicationCollection } from '../../../core/models/duplication-collection.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class DuplicationCollectionService {
  private readonly _collections$ = new BehaviorSubject<DuplicationCollection[]>([]);
  readonly collections$: Observable<DuplicationCollection[]> = this._collections$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): DuplicationCollection[] { return this._collections$.getValue(); }

  save(col: Partial<DuplicationCollection>): DuplicationCollection {
    return this.storage.save<DuplicationCollection>(STORAGE_KEYS.DUPLICATION_COLLECTIONS, col as DuplicationCollection);
  }

  delete(id: string): void {
    this.storage.delete(STORAGE_KEYS.DUPLICATION_COLLECTIONS, id);
  }

  private refresh(): void {
    this._collections$.next(
      this.storage.getAll<DuplicationCollection>(STORAGE_KEYS.DUPLICATION_COLLECTIONS)
    );
  }
}
```

---

## Step 4 — `RecurrentTransactionService`

File: `src/app/features/recurrent-transactions/services/recurrent-transaction.service.ts`

Copy from DESIGN_LOCAL_v5.md §6.8. Manages two storage keys (recurrent transactions + matches).

Key methods:
- `deleteWithMatches(id)` — deletes all match records for the recurrent, then deletes the recurrent itself.
- `getMatchForIteration(recurrentId, iterationKey)` — used by the dashboard to check current status.

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RecurrentTransaction } from '../../../core/models/recurrent-transaction.model';
import { RecurrentTransactionMatch } from '../../../core/models/recurrent-transaction-match.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class RecurrentTransactionService {
  private readonly _recurrents$ = new BehaviorSubject<RecurrentTransaction[]>([]);
  private readonly _matches$    = new BehaviorSubject<RecurrentTransactionMatch[]>([]);

  readonly recurrents$: Observable<RecurrentTransaction[]>       = this._recurrents$.asObservable();
  readonly matches$:    Observable<RecurrentTransactionMatch[]>  = this._matches$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): RecurrentTransaction[]           { return this._recurrents$.getValue(); }
  getAllMatches(): RecurrentTransactionMatch[] { return this._matches$.getValue(); }

  getMatchForIteration(
    recurrentId: string,
    iterationKey: string
  ): RecurrentTransactionMatch | undefined {
    return this.getAllMatches().find(
      m => m.recurrentTransactionId === recurrentId && m.strIterationKey === iterationKey
    );
  }

  save(r: Partial<RecurrentTransaction>): RecurrentTransaction {
    return this.storage.save<RecurrentTransaction>(STORAGE_KEYS.RECURRENT_TRANSACTIONS, r as RecurrentTransaction);
  }

  saveMatch(match: Partial<RecurrentTransactionMatch>): RecurrentTransactionMatch {
    return this.storage.save<RecurrentTransactionMatch>(STORAGE_KEYS.RECURRENT_MATCHES, match as RecurrentTransactionMatch);
  }

  deleteMatch(id: string): void {
    this.storage.delete(STORAGE_KEYS.RECURRENT_MATCHES, id);
  }

  deleteWithMatches(id: string): void {
    this.getAllMatches()
      .filter(m => m.recurrentTransactionId === id)
      .forEach(m => this.deleteMatch(m.id));
    this.storage.delete(STORAGE_KEYS.RECURRENT_TRANSACTIONS, id);
  }

  private refresh(): void {
    this._recurrents$.next(
      this.storage.getAll<RecurrentTransaction>(STORAGE_KEYS.RECURRENT_TRANSACTIONS)
    );
    this._matches$.next(
      this.storage.getAll<RecurrentTransactionMatch>(STORAGE_KEYS.RECURRENT_MATCHES)
    );
  }
}
```

---

## Step 5 — `ConciliationService`

File: `src/app/features/conciliation/services/conciliation.service.ts`

Copy from DESIGN_LOCAL_v5.md §6.5. Manages `CycleClose` and `CycleSnapshot` records.

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CycleClose } from '../../../core/models/cycle-close.model';
import { CycleSnapshot } from '../../../core/models/cycle-snapshot.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class ConciliationService {
  private readonly _cycleCloses$    = new BehaviorSubject<CycleClose[]>([]);
  private readonly _cycleSnapshots$ = new BehaviorSubject<CycleSnapshot[]>([]);

  readonly cycleCloses$:    Observable<CycleClose[]>    = this._cycleCloses$.asObservable();
  readonly cycleSnapshots$: Observable<CycleSnapshot[]> = this._cycleSnapshots$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getCycleCloses(): CycleClose[]         { return this._cycleCloses$.getValue(); }
  getCycleSnapshots(): CycleSnapshot[]   { return this._cycleSnapshots$.getValue(); }

  getMostRecentCycleClose(cardId: string): CycleClose | undefined {
    return this.getCycleCloses()
      .filter(cc => cc.cardId === cardId)
      .sort((a, b) => b.dateClosing.localeCompare(a.dateClosing))[0];
  }

  existsCycleClose(cardId: string, dateClosing: string): boolean {
    return this.getCycleCloses().some(
      cc => cc.cardId === cardId && cc.dateClosing === dateClosing
    );
  }

  saveCycleClose(record: Partial<CycleClose>): CycleClose {
    return this.storage.save<CycleClose>(STORAGE_KEYS.CYCLE_CLOSES, record as CycleClose);
  }

  saveCycleSnapshot(record: Partial<CycleSnapshot>): CycleSnapshot {
    return this.storage.save<CycleSnapshot>(STORAGE_KEYS.CYCLE_SNAPSHOTS, record as CycleSnapshot);
  }

  deleteCycleClose(id: string): void    { this.storage.delete(STORAGE_KEYS.CYCLE_CLOSES, id); }
  deleteCycleSnapshot(id: string): void { this.storage.delete(STORAGE_KEYS.CYCLE_SNAPSHOTS, id); }

  private refresh(): void {
    this._cycleCloses$.next(this.storage.getAll<CycleClose>(STORAGE_KEYS.CYCLE_CLOSES));
    this._cycleSnapshots$.next(this.storage.getAll<CycleSnapshot>(STORAGE_KEYS.CYCLE_SNAPSHOTS));
  }
}
```

---

## Directory Structure After This WP

```
src/app/features/
├── transactions/
│   └── services/
│       └── transaction.service.ts
├── categories/
│   └── services/
│       ├── category.service.ts
│       └── duplication-collection.service.ts
├── recurrent-transactions/
│   └── services/
│       └── recurrent-transaction.service.ts
└── conciliation/
    └── services/
        └── conciliation.service.ts
```

---

## Acceptance Criteria

- `npm run build` passes with no TypeScript errors.
- `CategoryService.saveRule()` throws when a duplicate `intPriority` is used.
- `CategoryService.deleteSubcategory()` invokes `transactionService.clearSubcategoryRef()`.
- `TransactionService.saveMany()` writes a batch of N transactions in a single `localStorage.setItem` call (not N separate calls).
- `RecurrentTransactionService.deleteWithMatches()` removes the match records before the recurrent transaction record.
