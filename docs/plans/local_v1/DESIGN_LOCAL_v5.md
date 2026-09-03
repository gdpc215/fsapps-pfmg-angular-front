# Credit Card Transaction Tracking System — Local-Only Design Document

**Version:** 1.5
**Date:** 2026-05-20
**Project:** fsapps-pfmg
**Variant:** Pure Angular frontend with localStorage persistence (no backend, no HTTP)

---

## Changelog from v1.3 (DESIGN_LOCAL_v4) → v1.5

**Scope constraints baked in:** This app runs locally for a single user with a maximum of ~1 000 transactions. No virtual scrolling, pagination, or performance optimizations are needed anywhere. The owner understands the consequences of refreshing the page mid-import.

**Breaking model changes:**
- `decCurrentBalance` removed from `CreditCard` and `DebitAccount`. Balance now derived on the fly from `ImportBatch.decBalanceAtImport` (§3, §11).
- New `AppSettings` model and `pfmg_settings` localStorage key (§3, §4, §6.9).

**StorageService (§5):**
- `persist()` wrapped in try-catch; throws `StorageWriteError` on quota exceeded.
- `getAll()` skips records missing the `id` field.
- UPDATE path: defensive `dateCreation` fallback.

**Feature services (§6):**
- `CreditCardService` and `DebitAccountService`: `deleteWithCascade()` replacing `delete()`.
- `CategoryService`: cascade-delete for categories and subcategories; subcategory delete nullifies transaction references.
- New `SettingsService` (§6.9).
- `ImportBatchService`: new `getLatestForAccount()` helper.

**Business logic services (§7):**
- `ExcelParserService`: pre-parse file guards; local-timezone date parsing; `parseAmount()` helper; enriched return type.
- `DuplicationLogicService`: `accountId` + `accountType` + `boolP2Enabled` parameters; float tolerance; P2 opt-in.
- `ConciliationCalculatorService`: closing-day clamp; `nonDeletedTransactions` input; PENDING in post-close.
- `RecurrentMatchingService`: `buildTargetDate` day clamping.
- `DashboardCalculatorService`: `computeCurrentBalance()`; PENDING in cycle; split uncategorized; stable sort.

**UI flows (§9–§14):**
- Import wizard: file validation; multi-sheet warning; deletion-intent pattern; CanDeactivate guard; confirm dialog; try-catch save; account-type routing.
- Conciliation: duplicate-cycle guard; first-cycle note.
- Recurrent dashboard: `NOT_CONFIGURED` status; last 2 iterations; Unlink action; bulk "Mark all done".
- Transaction explorer: text/date/amount filters; aggregate row.
- Monthly dashboard: month-nav math fix; future-month block; transfers toggle; split uncategorized; PENDING footnote.
- Cycle dashboard: computed balance; PENDING included; reactive recompute; stable sort; empty states.
- UX: CanDeactivate guard; wizard stepper header; back buttons; success toasts; confirm dialogs; empty states; mat-optgroup; consistent pipe/format usage; form validation; `routerLinkActive`.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [TypeScript Interfaces (All Entities)](#3-typescript-interfaces-all-entities)
4. [localStorage Schema](#4-localstorage-schema)
5. [StorageService](#5-storageservice)
6. [Feature Services](#6-feature-services)
7. [Business Logic Services](#7-business-logic-services)
8. [Angular Module and Component Structure](#8-angular-module-and-component-structure)
9. [Import Wizard — Data Flow](#9-import-wizard--data-flow)
10. [Conciliation UI Flow](#10-conciliation-ui-flow)
11. [Recurrent Dashboard — UI Flow](#11-recurrent-dashboard--ui-flow)
12. [Transaction Explorer — UI Flow](#12-transaction-explorer--ui-flow)
13. [Monthly Dashboard — Data Flow](#13-monthly-dashboard--data-flow)
14. [Cycle Dashboard — Data Flow](#14-cycle-dashboard--data-flow)
15. [localStorage Size Considerations](#15-localstorage-size-considerations)
16. [Migration Path to Backend](#16-migration-path-to-backend)

---

## 1. Overview

This variant runs entirely in the browser. All data is persisted in `localStorage` as JSON-serialized arrays. There is no backend, no HTTP calls, and no server-side business logic.

**Constraints this version is designed for:**
- Single user (the owner). No multi-user concerns, access control, or session management.
- Maximum ~1 000 transactions. No performance optimizations (virtual scrolling, pagination) needed.
- Runs on `localhost` only. Security hardening deferred.

Core capabilities:
- Multi-card management with per-card closing-day configuration
- Excel import with browser-side SheetJS parsing, duplication detection, and auto-categorization
- Category and rule management with priority-ordered auto-matching
- Cycle-based reconciliation with interest detection
- Soft-delete on transactions
- Multi-account management: credit cards (with conciliation) and debit accounts (no conciliation)
- Recurrent transaction tracking with MANUAL and AUTOMATIC matching
- Recurrent payment reminder dashboard (DONE/PENDING/NOT_YET_DUE/NOT_CONFIGURED)
- Transaction explorer with text, date, and amount filters
- Monthly income/expense dashboard with transfers toggle
- Per-card cycle expense dashboard

---

## 2. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Angular 19 |
| UI Components | Angular Material 19 |
| Styling | Tailwind CSS 3 |
| State management | RxJS `BehaviorSubject` (no NgRx) |
| Module loading | Lazy-loaded feature modules |
| Persistence | `localStorage` via `StorageService` |
| Excel parsing | SheetJS (`xlsx` npm package) |
| UUID generation | `crypto.randomUUID()` |
| HTTP | None |

---

## 3. TypeScript Interfaces (All Entities)

All interfaces live under `src/app/core/models/`. IDs are always `string`. Dates stored as `YYYY-MM-DD` strings. `dateCreation` and `dateModification` are ISO 8601 strings managed by `StorageService`.

```typescript
// src/app/core/models/base.model.ts
export interface BaseEntity {
  id: string;
  dateCreation: string;      // ISO 8601, set by StorageService on create
  dateModification: string;  // ISO 8601, updated on every save
}
```

```typescript
// src/app/core/models/credit-card.model.ts
import { BaseEntity } from './base.model';

export interface CreditCard extends BaseEntity {
  strName: string;
  intClosingDay: number;   // 1–31; validated at form level
  intPaymentDay: number;   // 1–31; validated at form level
  // decCurrentBalance REMOVED — balance derived from ImportBatch (see §11)
}
```

```typescript
// src/app/core/models/debit-account.model.ts
import { BaseEntity } from './base.model';

export interface DebitAccount extends BaseEntity {
  strName: string;
  // decCurrentBalance REMOVED — balance derived from ImportBatch (see §11)
}
```

```typescript
// src/app/core/models/transaction.model.ts
import { BaseEntity } from './base.model';

export type TransactionCurrency = 'PEN' | 'USD';
export type TransactionStatus   = 'ACTIVE' | 'DELETED' | 'PENDING';
export type AccountType         = 'CREDIT_CARD' | 'DEBIT_ACCOUNT';

export interface Transaction extends BaseEntity {
  accountId: string;
  accountType: AccountType;
  importBatchId?: string;
  dateTransaction: string;           // YYYY-MM-DD
  strDescription: string;
  strCurrency: TransactionCurrency;
  decAmount: number;                 // negative = charge; positive = payment/refund
  decAmountPen: number;              // always PEN; USD = decAmount × exchange rate at import
  subcategoryId?: string;
  strNotes?: string;
  strStatus: TransactionStatus;
  strOperationNumber?: string;       // debit only; from Excel; used for D1 rule
  transferGroupId?: string;          // shared UUID linking two transfer transactions
}
```

```typescript
// src/app/core/models/import-batch.model.ts
import { BaseEntity } from './base.model';
import { AccountType, TransactionCurrency } from './transaction.model';

export interface ImportBatch extends BaseEntity {
  accountId: string;
  accountType: AccountType;
  dateImport: string;            // YYYY-MM-DD
  decUsdExchangeRate: number;    // PEN per 1 USD; always provided even for PEN-only files
  decBalanceAtImport: number;    // credit: negative = owed; debit: positive = balance
}

export interface RawImportRow {
  dateTransaction: string;
  description: string;
  currency: TransactionCurrency;
  amount: number;
  amountPen: number;             // PEN-converted at parse time
  strOperationNumber?: string;   // debit accounts only
}

export interface ParseFileResult {
  rows: RawImportRow[];
  hasMultipleSheets: boolean;
  hasUsdRows: boolean;
}
```

```typescript
// src/app/core/models/category.model.ts
import { BaseEntity } from './base.model';

export interface Category extends BaseEntity { strName: string; }

export interface Subcategory extends BaseEntity {
  categoryId: string;
  strName: string;
}
```

```typescript
// src/app/core/models/category-rule.model.ts
import { BaseEntity } from './base.model';

export type MatchType = 'STARTS_WITH' | 'CONTAINS' | 'ENDS_WITH' | 'EQUALS';

export interface CategoryRule extends BaseEntity {
  subcategoryId: string;
  strMatchString: string;
  strMatchType: MatchType;
  intPriority: number;   // unique; lower = higher priority; first match wins
}
```

```typescript
// src/app/core/models/duplication-collection.model.ts
import { BaseEntity } from './base.model';

export interface DuplicationCollection extends BaseEntity {
  strName: string;
  strings: string[];
}
```

```typescript
// src/app/core/models/recurrent-transaction.model.ts
import { BaseEntity } from './base.model';
import { AccountType, TransactionCurrency } from './transaction.model';

export type RecurrenceFrequency  = 'MONTHLY' | 'YEARLY';
export type RecurrenceMatchMode  = 'MANUAL' | 'AUTOMATIC';
export type RecurrentStatus      = 'DONE' | 'PENDING' | 'NOT_YET_DUE' | 'NOT_CONFIGURED';

export interface RecurrentTransaction extends BaseEntity {
  strName: string;
  strNotes?: string;
  accountId: string;
  accountType: AccountType;
  strFrequency: RecurrenceFrequency;
  strMatchMode: RecurrenceMatchMode;
  // AUTOMATIC mode fields — all required for AUTOMATIC, forbidden for MANUAL
  strCurrency?: TransactionCurrency;
  decApproxAmount?: number;
  decAmountRange?: number;
  strMatchString?: string;
  intApproxDay?: number;
  intApproxMonth?: number;  // YEARLY only
  intDayRange?: number;     // required for AUTOMATIC
}
```

```typescript
// src/app/core/models/recurrent-transaction-match.model.ts
import { BaseEntity } from './base.model';
import { RecurrenceMatchMode } from './recurrent-transaction.model';

export interface RecurrentTransactionMatch extends BaseEntity {
  recurrentTransactionId: string;
  strIterationKey: string;    // 'YYYY-MM' for MONTHLY; 'YYYY' for YEARLY
  transactionId?: string;
  boolDone: boolean;
  dateDone?: string;          // YYYY-MM-DD
  strMatchMode: RecurrenceMatchMode;
}
```

```typescript
// src/app/core/models/cycle-snapshot.model.ts
import { BaseEntity } from './base.model';

export type SnapshotType = 'SNAPSHOT' | 'CYCLE_CLOSE';

export interface CycleSnapshot extends BaseEntity {
  cardId: string;
  dateSnapshot: string;
  decBalanceAtSnapshot: number;
  strType: SnapshotType;
}
```

```typescript
// src/app/core/models/cycle-close.model.ts
import { BaseEntity } from './base.model';

export interface CycleClose extends BaseEntity {
  cardId: string;
  dateClosing: string;
  decOpeningBalance: number;
  decClosingBalance: number;
  decInterestAmount: number;
  interestTransactionId?: string;
}
```

```typescript
// src/app/core/models/app-settings.model.ts
export interface AppSettings {
  boolP2RuleEnabled: boolean;  // default: false; P2 duplication rule is opt-in
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  boolP2RuleEnabled: false,
};
```

---

## 4. localStorage Schema

| Key | Type | Description |
|---|---|---|
| `pfmg_credit_cards` | `CreditCard[]` | Registered credit cards |
| `pfmg_debit_accounts` | `DebitAccount[]` | Registered debit/savings accounts |
| `pfmg_transactions` | `Transaction[]` | All transactions (including DELETED) |
| `pfmg_import_batches` | `ImportBatch[]` | One record per Excel import |
| `pfmg_categories` | `Category[]` | Top-level categories |
| `pfmg_subcategories` | `Subcategory[]` | Subcategories linked to a category |
| `pfmg_category_rules` | `CategoryRule[]` | Auto-categorization rules |
| `pfmg_duplication_collections` | `DuplicationCollection[]` | Named string sets for P3 detection |
| `pfmg_cycle_snapshots` | `CycleSnapshot[]` | Balance snapshots |
| `pfmg_cycle_closes` | `CycleClose[]` | Finalized cycle reconciliation records |
| `pfmg_recurrent_transactions` | `RecurrentTransaction[]` | Recurrent transaction templates |
| `pfmg_recurrent_matches` | `RecurrentTransactionMatch[]` | Per-iteration match records |
| `pfmg_settings` | `AppSettings` (single object) | App-level settings (not an array) |

`pfmg_settings` is stored as a single JSON object, not a JSON array. `SettingsService` reads and writes it directly.

---

## 5. StorageService

`StorageService` is the single point of contact with `localStorage`. No other service or component accesses `localStorage` directly except `SettingsService` (which manages the non-array `pfmg_settings` key).

```typescript
// src/app/core/services/storage.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export class StorageWriteError extends Error {
  constructor(public readonly key: string, cause: unknown) {
    super(`Failed to write localStorage key "${key}"`);
    this.cause = cause;
  }
}

@Injectable({ providedIn: 'root' })
export class StorageService {

  readonly changes$ = new BehaviorSubject<void>(undefined);

  getAll<T extends { id?: string }>(key: string): T[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown[];
      // Skip records missing the id field (corrupted entries)
      return parsed.filter((item): item is T =>
        typeof item === 'object' && item !== null && 'id' in item
      );
    } catch {
      console.error(`StorageService: failed to parse key "${key}"`);
      return [];
    }
  }

  save<T extends { id?: string; dateCreation?: string; dateModification?: string }>(
    key: string,
    record: T
  ): T {
    const all = this.getAll<T>(key);
    const now = new Date().toISOString();
    let saved: T;

    if (!record.id) {
      saved = { ...record, id: crypto.randomUUID(), dateCreation: now, dateModification: now };
      all.push(saved);
    } else {
      const idx = all.findIndex((item: any) => item.id === record.id);
      saved = { ...record, dateModification: now };
      if (idx === -1) {
        saved = { ...saved, dateCreation: now };
        all.push(saved);
      } else {
        saved = {
          ...(all[idx] as any),
          ...saved,
          dateCreation: (all[idx] as any).dateCreation ?? now,  // defensive fallback
          dateModification: now,
        };
        all[idx] = saved;
      }
    }

    this.persist(key, all);
    return saved;
  }

  delete(key: string, id: string): void {
    const all = this.getAll<{ id: string }>(key);
    this.persist(key, all.filter(item => item.id !== id));
  }

  saveAll<T>(key: string, records: T[]): void {
    this.persist(key, records);
  }

  clear(key: string): void {
    localStorage.removeItem(key);
    this.changes$.next();
  }

  getTotalBytes(): number {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      total += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
    return total;
  }

  private persist<T>(key: string, data: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this.changes$.next();
    } catch (err) {
      throw new StorageWriteError(key, err);
    }
  }
}
```

```typescript
// src/app/core/services/storage-keys.ts
export const STORAGE_KEYS = {
  CREDIT_CARDS:             'pfmg_credit_cards',
  DEBIT_ACCOUNTS:           'pfmg_debit_accounts',
  TRANSACTIONS:             'pfmg_transactions',
  IMPORT_BATCHES:           'pfmg_import_batches',
  CATEGORIES:               'pfmg_categories',
  SUBCATEGORIES:            'pfmg_subcategories',
  CATEGORY_RULES:           'pfmg_category_rules',
  DUPLICATION_COLLECTIONS:  'pfmg_duplication_collections',
  CYCLE_SNAPSHOTS:          'pfmg_cycle_snapshots',
  CYCLE_CLOSES:             'pfmg_cycle_closes',
  RECURRENT_TRANSACTIONS:   'pfmg_recurrent_transactions',
  RECURRENT_MATCHES:        'pfmg_recurrent_matches',
} as const;

export const SETTINGS_KEY = 'pfmg_settings';
```

---

## 6. Feature Services

### 6.1 CreditCardService

```typescript
// src/app/features/credit-cards/services/credit-card.service.ts
@Injectable({ providedIn: 'root' })
export class CreditCardService {
  private readonly _cards$ = new BehaviorSubject<CreditCard[]>([]);
  readonly cards$: Observable<CreditCard[]> = this._cards$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): CreditCard[] { return this._cards$.getValue(); }
  getById(id: string): CreditCard | undefined { return this.getAll().find(c => c.id === id); }

  save(card: Partial<CreditCard>): CreditCard {
    return this.storage.save<CreditCard>(STORAGE_KEYS.CREDIT_CARDS, card as CreditCard);
  }

  /** Removes the card and all associated data. Call after user confirms the cascade dialog. */
  deleteWithCascade(
    id: string,
    deps: {
      transactionService: TransactionService;
      importBatchService: ImportBatchService;
      conciliationService: ConciliationService;
      recurrentService: RecurrentTransactionService;
    }
  ): void {
    // 1. Soft-delete all transactions
    deps.transactionService.getAll()
      .filter(t => t.accountId === id)
      .forEach(t => deps.transactionService.softDelete(t.id));

    // 2. Delete import batches
    deps.importBatchService.getAll()
      .filter(b => b.accountId === id)
      .forEach(b => deps.importBatchService.delete(b.id));

    // 3. Delete cycle closes and snapshots
    deps.conciliationService.getCycleCloses()
      .filter(cc => cc.cardId === id)
      .forEach(cc => deps.conciliationService.deleteCycleClose(cc.id));
    deps.conciliationService.getCycleSnapshots()
      .filter(s => s.cardId === id)
      .forEach(s => deps.conciliationService.deleteCycleSnapshot(s.id));

    // 4. Delete recurrent transactions (and their matches)
    deps.recurrentService.getAll()
      .filter(r => r.accountId === id)
      .forEach(r => deps.recurrentService.deleteWithMatches(r.id));

    // 5. Delete the card
    this.storage.delete(STORAGE_KEYS.CREDIT_CARDS, id);
  }

  private refresh(): void {
    this._cards$.next(this.storage.getAll<CreditCard>(STORAGE_KEYS.CREDIT_CARDS));
  }
}
```

**UI usage:** Before calling `deleteWithCascade`, the component opens a `MatDialog` showing: *"Deleting 'BCP Visa Gold' will also remove N transactions, M import batches, P cycle records, and Q recurring entries. This cannot be undone."*

### 6.2 TransactionService

```typescript
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

  /** Nullify subcategoryId on all transactions referencing the given subcategoryId. */
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

### 6.3 ImportBatchService

```typescript
@Injectable({ providedIn: 'root' })
export class ImportBatchService {
  private readonly _batches$ = new BehaviorSubject<ImportBatch[]>([]);
  readonly batches$: Observable<ImportBatch[]> = this._batches$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): ImportBatch[] { return this._batches$.getValue(); }

  /** Returns the most recent import batch for an account, or undefined if none. */
  getLatestForAccount(accountId: string): ImportBatch | undefined {
    return this.getAll()
      .filter(b => b.accountId === accountId)
      .sort((a, b) => b.dateImport.localeCompare(a.dateImport))[0];
  }

  save(batch: Partial<ImportBatch>): ImportBatch {
    return this.storage.save<ImportBatch>(STORAGE_KEYS.IMPORT_BATCHES, batch as ImportBatch);
  }

  delete(id: string): void { this.storage.delete(STORAGE_KEYS.IMPORT_BATCHES, id); }

  private refresh(): void {
    this._batches$.next(this.storage.getAll<ImportBatch>(STORAGE_KEYS.IMPORT_BATCHES));
  }
}
```

### 6.4 CategoryService

```typescript
@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly _categories$   = new BehaviorSubject<Category[]>([]);
  private readonly _subcategories$ = new BehaviorSubject<Subcategory[]>([]);
  private readonly _rules$         = new BehaviorSubject<CategoryRule[]>([]);

  readonly categories$:   Observable<Category[]>    = this._categories$.asObservable();
  readonly subcategories$: Observable<Subcategory[]> = this._subcategories$.asObservable();
  readonly rules$:         Observable<CategoryRule[]> = this._rules$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getCategories(): Category[]    { return this._categories$.getValue(); }
  getSubcategories(): Subcategory[] { return this._subcategories$.getValue(); }
  getRules(): CategoryRule[]     { return this._rules$.getValue(); }

  getSubcategoriesByCategoryId(categoryId: string): Subcategory[] {
    return this.getSubcategories().filter(s => s.categoryId === categoryId);
  }

  saveCategory(cat: Partial<Category>): Category {
    return this.storage.save<Category>(STORAGE_KEYS.CATEGORIES, cat as Category);
  }

  saveSubcategory(sub: Partial<Subcategory>): Subcategory {
    return this.storage.save<Subcategory>(STORAGE_KEYS.SUBCATEGORIES, sub as Subcategory);
  }

  /** Rejects if another rule already holds the same intPriority. */
  saveRule(rule: Partial<CategoryRule>): CategoryRule {
    const existing = this.getRules();
    const conflict = existing.find(r => r.intPriority === rule.intPriority && r.id !== rule.id);
    if (conflict) throw new Error(`Priority ${rule.intPriority} is already used by rule "${conflict.strMatchString}"`);
    return this.storage.save<CategoryRule>(STORAGE_KEYS.CATEGORY_RULES, rule as CategoryRule);
  }

  /** Cascade-deletes all subcategories of the category first. */
  deleteCategory(id: string, transactionService: TransactionService): void {
    const subs = this.getSubcategoriesByCategoryId(id);
    for (const sub of subs) {
      this.deleteSubcategory(sub.id, transactionService);
    }
    this.storage.delete(STORAGE_KEYS.CATEGORIES, id);
  }

  /** Nullifies subcategoryId on all referencing transactions, then deletes the subcategory. */
  deleteSubcategory(id: string, transactionService: TransactionService): void {
    transactionService.clearSubcategoryRef(id);
    this.storage.delete(STORAGE_KEYS.SUBCATEGORIES, id);
  }

  deleteRule(id: string): void { this.storage.delete(STORAGE_KEYS.CATEGORY_RULES, id); }

  private refresh(): void {
    this._categories$.next(this.storage.getAll<Category>(STORAGE_KEYS.CATEGORIES));
    this._subcategories$.next(this.storage.getAll<Subcategory>(STORAGE_KEYS.SUBCATEGORIES));
    this._rules$.next(this.storage.getAll<CategoryRule>(STORAGE_KEYS.CATEGORY_RULES));
  }
}
```

**UI usage for `deleteSubcategory`:** The component shows: *"Deleting 'Supermercado' will clear the subcategory on N transactions. They will become uncategorized."*

**UI usage for `deleteCategory`:** Shows total transaction count across all its subcategories.

### 6.5 ConciliationService

```typescript
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

  getCycleCloses(): CycleClose[]       { return this._cycleCloses$.getValue(); }
  getCycleSnapshots(): CycleSnapshot[] { return this._cycleSnapshots$.getValue(); }

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

### 6.6 DuplicationCollectionService

```typescript
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

  delete(id: string): void { this.storage.delete(STORAGE_KEYS.DUPLICATION_COLLECTIONS, id); }

  private refresh(): void {
    this._collections$.next(this.storage.getAll<DuplicationCollection>(STORAGE_KEYS.DUPLICATION_COLLECTIONS));
  }
}
```

### 6.7 DebitAccountService

```typescript
@Injectable({ providedIn: 'root' })
export class DebitAccountService {
  private readonly _accounts$ = new BehaviorSubject<DebitAccount[]>([]);
  readonly accounts$: Observable<DebitAccount[]> = this._accounts$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): DebitAccount[] { return this._accounts$.getValue(); }
  getById(id: string): DebitAccount | undefined { return this.getAll().find(a => a.id === id); }

  save(account: Partial<DebitAccount>): DebitAccount {
    return this.storage.save<DebitAccount>(STORAGE_KEYS.DEBIT_ACCOUNTS, account as DebitAccount);
  }

  /** Removes the account and all associated data. Call after user confirms the cascade dialog. */
  deleteWithCascade(
    id: string,
    deps: {
      transactionService: TransactionService;
      importBatchService: ImportBatchService;
      recurrentService: RecurrentTransactionService;
    }
  ): void {
    deps.transactionService.getAll()
      .filter(t => t.accountId === id)
      .forEach(t => deps.transactionService.softDelete(t.id));

    deps.importBatchService.getAll()
      .filter(b => b.accountId === id)
      .forEach(b => deps.importBatchService.delete(b.id));

    deps.recurrentService.getAll()
      .filter(r => r.accountId === id)
      .forEach(r => deps.recurrentService.deleteWithMatches(r.id));

    this.storage.delete(STORAGE_KEYS.DEBIT_ACCOUNTS, id);
  }

  private refresh(): void {
    this._accounts$.next(this.storage.getAll<DebitAccount>(STORAGE_KEYS.DEBIT_ACCOUNTS));
  }
}
```

### 6.8 RecurrentTransactionService

```typescript
@Injectable({ providedIn: 'root' })
export class RecurrentTransactionService {
  private readonly _recurrents$ = new BehaviorSubject<RecurrentTransaction[]>([]);
  private readonly _matches$    = new BehaviorSubject<RecurrentTransactionMatch[]>([]);

  readonly recurrents$: Observable<RecurrentTransaction[]>      = this._recurrents$.asObservable();
  readonly matches$:    Observable<RecurrentTransactionMatch[]> = this._matches$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): RecurrentTransaction[]          { return this._recurrents$.getValue(); }
  getAllMatches(): RecurrentTransactionMatch[] { return this._matches$.getValue(); }

  getMatchForIteration(recurrentId: string, iterationKey: string): RecurrentTransactionMatch | undefined {
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

  deleteMatch(id: string): void { this.storage.delete(STORAGE_KEYS.RECURRENT_MATCHES, id); }

  deleteWithMatches(id: string): void {
    // Delete all match records for this recurrent first
    this.getAllMatches()
      .filter(m => m.recurrentTransactionId === id)
      .forEach(m => this.deleteMatch(m.id));
    this.storage.delete(STORAGE_KEYS.RECURRENT_TRANSACTIONS, id);
  }

  private refresh(): void {
    this._recurrents$.next(this.storage.getAll<RecurrentTransaction>(STORAGE_KEYS.RECURRENT_TRANSACTIONS));
    this._matches$.next(this.storage.getAll<RecurrentTransactionMatch>(STORAGE_KEYS.RECURRENT_MATCHES));
  }
}
```

### 6.9 SettingsService (new)

```typescript
// src/app/core/services/settings.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../models/app-settings.model';
import { SETTINGS_KEY } from './storage-keys';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _settings$ = new BehaviorSubject<AppSettings>(this.load());
  readonly settings$: Observable<AppSettings> = this._settings$.asObservable();

  getSettings(): AppSettings { return this._settings$.getValue(); }

  saveSettings(partial: Partial<AppSettings>): AppSettings {
    const updated: AppSettings = { ...this.getSettings(), ...partial };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch {
      console.error('SettingsService: failed to persist settings');
    }
    this._settings$.next(updated);
    return updated;
  }

  private load(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_APP_SETTINGS };
      return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      return { ...DEFAULT_APP_SETTINGS };
    }
  }
}
```

---

## 7. Business Logic Services

These services are **pure and stateless** — they accept plain data and return results. No dependency on `StorageService` or feature services. See `BUSINESS_LOGIC_v2.md` for full algorithm specifications.

### 7.1 ExcelParserService

Parses an `.xlsx` File object into `RawImportRow[]` via SheetJS. Returns `ParseFileResult`.

**Key behaviors:**
- Pre-parse guards: extension check + 10 MB size limit (throw before `arrayBuffer()`).
- Multi-sheet workbooks: always read `SheetNames[0]`; set `hasMultipleSheets = true` in result.
- `parseDate()`: uses local date components from JS `Date` objects to avoid UTC timezone shift.
- `parseAmount()`: strips commas, returns `0` on NaN (never stores NaN).
- Returns `hasUsdRows` so Step 1 can conditionally require the exchange rate field.

```typescript
// src/app/core/services/excel-parser.service.ts
import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { RawImportRow, ParseFileResult } from '../models/import-batch.model';

const COL_FECHA         = 'Fecha';
const COL_DESCRIPCION   = 'Descripcion';
const COL_MONEDA        = 'Moneda';
const COL_MONTO         = 'Monto';
const COL_OPERACION     = 'N° Operacion';
const COL_OPERACION_ALT = 'Operacion';

export class ParseValidationError extends Error {
  constructor(message: string) { super(message); }
}

@Injectable({ providedIn: 'root' })
export class ExcelParserService {

  async parseFile(file: File, usdExchangeRate: number): Promise<ParseFileResult> {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      throw new ParseValidationError('Only .xlsx files are supported.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new ParseValidationError('File is too large (max 10 MB).');
    }

    const buffer   = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const hasMultipleSheets = workbook.SheetNames.length > 1;

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const rows: RawImportRow[] = rawRows
      .filter(r =>
        r[COL_FECHA]       != null &&
        r[COL_DESCRIPCION] != null &&
        r[COL_MONEDA]      != null &&
        r[COL_MONTO]       != null
      )
      .map(r => {
        const currency = String(r[COL_MONEDA]).trim() === '$' ? 'USD' : 'PEN';
        const amount   = this.parseAmount(r[COL_MONTO]);
        return {
          dateTransaction: this.parseDate(r[COL_FECHA]),
          description:     String(r[COL_DESCRIPCION]).trim(),
          currency,
          amount,
          amountPen: currency === 'PEN' ? amount : amount * usdExchangeRate,
          strOperationNumber: r[COL_OPERACION] != null
            ? String(r[COL_OPERACION]).trim()
            : r[COL_OPERACION_ALT] != null
              ? String(r[COL_OPERACION_ALT]).trim()
              : undefined,
        } satisfies RawImportRow;
      });

    return {
      rows,
      hasMultipleSheets,
      hasUsdRows: rows.some(r => r.currency === 'USD'),
    };
  }

  private parseDate(value: any): string {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(value).trim();
    // DD/MM/YYYY (common Peruvian bank format)
    const ddmm = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (ddmm) return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
    // YYYY-MM-DD passthrough
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    return str; // unknown; will fail row-level validation downstream
  }

  private parseAmount(raw: any): number {
    if (raw == null) return 0;
    const cleaned = String(raw).replace(/,/g, '');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
}
```

### 7.2 DuplicationLogicService

Implements the full duplication detection algorithm. See BUSINESS_LOGIC_v2.md §2 for complete decision tree.

```typescript
// src/app/core/services/duplication-logic.service.ts
export type DuplicationFlag = 'NONE' | 'AUTO_DUPLICATE' | 'POTENTIAL_DUPLICATE';

export interface AnnotatedImportRow {
  raw: RawImportRow;
  flag: DuplicationFlag;
  matchingTransaction?: Transaction;
  subcategoryId?: string;
  note?: string;
  pendingFlag?: boolean;
  checked: boolean;
}

@Injectable({ providedIn: 'root' })
export class DuplicationLogicService {

  annotate(
    incoming: RawImportRow[],
    existing: Transaction[],
    collections: DuplicationCollection[],
    accountId: string,
    accountType: AccountType,
    boolP2Enabled: boolean
  ): AnnotatedImportRow[] {
    // Pre-filter: only ACTIVE transactions for this specific account
    const activeForAccount = existing.filter(
      t => t.accountId === accountId && t.strStatus === 'ACTIVE'
    );
    return incoming.map(row =>
      this.annotateRow(row, activeForAccount, collections, accountType, boolP2Enabled)
    );
  }

  private annotateRow(
    row: RawImportRow,
    existing: Transaction[],
    collections: DuplicationCollection[],
    accountType: AccountType,
    boolP2Enabled: boolean
  ): AnnotatedImportRow {
    // D1: debit only
    if (accountType === 'DEBIT_ACCOUNT' && row.strOperationNumber) {
      const d1 = existing.find(t =>
        t.strOperationNumber === row.strOperationNumber &&
        t.dateTransaction    === row.dateTransaction
      );
      if (d1) return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: d1, checked: false };
    }

    // A1: exact match
    const a1 = existing.find(t =>
      t.dateTransaction === row.dateTransaction &&
      t.strDescription  === row.description &&
      t.strCurrency     === row.currency &&
      this.amountsMatch(t.decAmount, row.amount)
    );
    if (a1) return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: a1, checked: false };

    // A2: USD floating date
    if (row.currency === 'USD') {
      const a2 = existing.find(t =>
        t.strCurrency    === 'USD' &&
        t.strDescription === row.description &&
        this.amountsMatch(t.decAmount, row.amount) &&
        this.daysDiff(t.dateTransaction, row.dateTransaction) <= 3
      );
      if (a2) return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: a2, checked: false };
    }

    // P1: prefix + amount + date
    const desc10 = row.description.slice(0, 10).toLowerCase();
    const p1 = existing.find(t =>
      this.amountsMatch(t.decAmount, row.amount) &&
      t.strDescription.slice(0, 10).toLowerCase() === desc10 &&
      this.daysDiff(t.dateTransaction, row.dateTransaction) <= 3
    );
    if (p1) return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p1, checked: true };

    // P2: amount + date (opt-in)
    if (boolP2Enabled) {
      const p2 = existing.find(t =>
        this.amountsMatch(t.decAmount, row.amount) &&
        this.daysDiff(t.dateTransaction, row.dateTransaction) <= 3
      );
      if (p2) return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p2, checked: true };
    }

    // P3: collection-based
    for (const col of collections) {
      const inHit = col.strings.find(s => row.description.toLowerCase().includes(s.toLowerCase()));
      if (inHit) {
        const p3 = existing.find(t => {
          const exHit = col.strings.some(s => t.strDescription.toLowerCase().includes(s.toLowerCase()));
          return exHit &&
            this.amountsMatch(t.decAmount, row.amount) &&
            t.strCurrency === row.currency &&
            this.daysDiff(t.dateTransaction, row.dateTransaction) <= 3;
        });
        if (p3) return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p3, checked: true };
      }
    }

    return { raw: row, flag: 'NONE', checked: true };
  }

  private amountsMatch(a: number, b: number): boolean {
    return Math.abs(a - b) < 0.001;
  }

  private daysDiff(dateA: string, dateB: string): number {
    return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / 86_400_000;
  }
}
```

### 7.3 CategoryMatchingService

No changes from v4. Matches description against ordered `CategoryRule[]`; returns first matching `subcategoryId` or `undefined`.

### 7.4 ConciliationCalculatorService

See BUSINESS_LOGIC_v2.md §4 for complete specification.

Key changes from v4:
- `buildCycleWindow` clamps `intClosingDay` to end-of-month via `daysInMonth` helper.
- Input field renamed to `nonDeletedTransactions` (ACTIVE+PENDING accepted; function filters by status internally).
- `postCloseMovementsSum` includes PENDING (all non-DELETED).

```typescript
// src/app/core/services/conciliation-calculator.service.ts

export interface ConciliationInput {
  cardId: string;
  intClosingDay: number;
  todayDate: string;
  currentBalance: number;
  previousClosingBalance: number;
  nonDeletedTransactions: Transaction[];  // ACTIVE + PENDING; service filters internally
}

// ConciliationResult and CycleWindow interfaces unchanged from v4.

@Injectable({ providedIn: 'root' })
export class ConciliationCalculatorService {

  calculate(input: ConciliationInput): ConciliationResult {
    const window       = this.buildCycleWindow(input.intClosingDay, input.todayDate);
    const openingBalance = input.previousClosingBalance;

    const cycleMovementsSum = input.nonDeletedTransactions
      .filter(t =>
        t.accountId === input.cardId &&
        t.strStatus === 'ACTIVE' &&             // confirmed only in cycle
        t.dateTransaction >= window.cycleStart &&
        t.dateTransaction <= window.closingDate
      )
      .reduce((s, t) => s + t.decAmountPen, 0);

    const amountA = openingBalance + cycleMovementsSum;

    const postCloseMovementsSum = input.nonDeletedTransactions
      .filter(t =>
        t.accountId === input.cardId &&
        t.strStatus !== 'DELETED' &&            // includes PENDING
        t.dateTransaction > window.closingDate &&
        t.dateTransaction <= input.todayDate
      )
      .reduce((s, t) => s + t.decAmountPen, 0);

    const currentBalanceNegated = -Math.abs(input.currentBalance);
    const amountB       = currentBalanceNegated - postCloseMovementsSum;
    const rawInterest   = amountB - amountA;
    const interestAmount = Math.abs(rawInterest) < 0.01 ? 0 : rawInterest;

    return { window, openingBalance, cycleMovementsSum, amountA,
             postCloseMovementsSum, currentBalanceNegated, amountB, interestAmount };
  }

  buildCycleWindow(intClosingDay: number, todayDate: string): CycleWindow {
    const today = new Date(todayDate + 'T12:00:00');
    const year  = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    const clampedDay    = Math.min(intClosingDay, this.daysInMonth(year, month));
    const closingDate   = new Date(year, month, clampedDay);

    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear  = month === 0 ? year - 1 : year;
    const prevClamp = Math.min(intClosingDay, this.daysInMonth(prevYear, prevMonth));
    const cycleStart = new Date(prevYear, prevMonth, prevClamp + 1);

    return {
      cycleStart:  this.formatDate(cycleStart),
      closingDate: this.formatDate(closingDate),
    };
  }

  daysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
```

### 7.5 RecurrentMatchingService

Key change from v4: `buildTargetDate` clamps `intApproxDay` to the last day of the target month.

```typescript
// src/app/core/services/recurrent-matching.service.ts
// (full service — only buildTargetDate and daysInMonth shown as changes)

private buildTargetDate(r: RecurrentTransaction, iterationKey: string): string | undefined {
  if (r.intApproxDay == null) return undefined;

  if (r.strFrequency === 'MONTHLY') {
    const year  = parseInt(iterationKey.slice(0, 4), 10);
    const month = parseInt(iterationKey.slice(5, 7), 10) - 1; // 0-indexed
    const day   = Math.min(r.intApproxDay, this.daysInMonth(year, month));
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // YEARLY
  const year  = parseInt(iterationKey, 10);
  const month = (r.intApproxMonth ?? 1) - 1; // 0-indexed
  const day   = Math.min(r.intApproxDay, this.daysInMonth(year, month));
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

private daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
```

### 7.6 DashboardCalculatorService

```typescript
// src/app/core/services/dashboard-calculator.service.ts

export interface MonthlyDashboardData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  bySubcategory: SubcategoryTotal[];
  uncategorizedIncome: number;    // split from old uncategorizedTotal
  uncategorizedExpenses: number;
  pendingCount: number;           // for PENDING footnote
  pendingTotal: number;
}

export interface CycleDashboardCardData {
  card: CreditCard;
  cycleWindow: CycleWindow;
  totalExpenses: number;
  totalPayments: number;
  transactionCount: number;
  topSubcategories: SubcategoryTotal[];
  balanceAtLastImport: number;    // from computeCurrentBalance
  balanceImportDate: string;      // date of the latest ImportBatch
}

@Injectable({ providedIn: 'root' })
export class DashboardCalculatorService {

  constructor(private conciliationCalculator: ConciliationCalculatorService) {}

  /** Balance derived from the latest import batch for the account. */
  computeCurrentBalance(accountId: string, importBatches: ImportBatch[]): {
    balance: number; importDate: string | undefined
  } {
    const latest = importBatches
      .filter(b => b.accountId === accountId)
      .sort((a, b) => b.dateImport.localeCompare(a.dateImport))[0];
    return {
      balance:    latest?.decBalanceAtImport ?? 0,
      importDate: latest?.dateImport,
    };
  }

  computeMonthly(
    month: string,
    transactions: Transaction[],
    subcategories: Subcategory[],
    categories: Category[],
    hideTransfers = false
  ): MonthlyDashboardData {
    let inMonth = transactions.filter(
      t => t.strStatus !== 'DELETED' && t.dateTransaction.startsWith(month)
    );

    if (hideTransfers) {
      inMonth = inMonth.filter(t => t.transferGroupId == null);
    }

    const totalIncome   = inMonth.filter(t => t.decAmountPen > 0).reduce((s, t) => s + t.decAmountPen, 0);
    const totalExpenses = inMonth.filter(t => t.decAmountPen < 0).reduce((s, t) => s + t.decAmountPen, 0);

    const pending     = inMonth.filter(t => t.strStatus === 'PENDING');
    const pendingCount = pending.length;
    const pendingTotal = pending.reduce((s, t) => s + t.decAmountPen, 0);

    const categorized   = inMonth.filter(t => t.subcategoryId != null);
    const uncategorized = inMonth.filter(t => t.subcategoryId == null);

    return {
      month,
      totalIncome,
      totalExpenses,
      netAmount: totalIncome + totalExpenses,
      bySubcategory: this.groupBySubcategory(categorized, subcategories, categories),
      uncategorizedIncome:   uncategorized.filter(t => t.decAmountPen > 0).reduce((s, t) => s + t.decAmountPen, 0),
      uncategorizedExpenses: uncategorized.filter(t => t.decAmountPen < 0).reduce((s, t) => s + t.decAmountPen, 0),
      pendingCount,
      pendingTotal,
    };
  }

  computeCycleSummary(
    card: CreditCard,
    todayDate: string,
    transactions: Transaction[],
    importBatches: ImportBatch[],
    subcategories: Subcategory[],
    categories: Category[]
  ): CycleDashboardCardData {
    const cycleWindow = this.conciliationCalculator.buildCycleWindow(card.intClosingDay, todayDate);

    const cycleTxns = transactions.filter(
      t => t.strStatus !== 'DELETED' &&     // includes PENDING (consistent with monthly)
           t.accountId === card.id &&
           t.dateTransaction >= cycleWindow.cycleStart &&
           t.dateTransaction <= cycleWindow.closingDate
    );

    const totalExpenses = Math.abs(cycleTxns.filter(t => t.decAmountPen < 0).reduce((s, t) => s + t.decAmountPen, 0));
    const totalPayments =           cycleTxns.filter(t => t.decAmountPen > 0).reduce((s, t) => s + t.decAmountPen, 0);

    const bySub = this.groupBySubcategory(cycleTxns.filter(t => t.subcategoryId != null), subcategories, categories);
    const topSubcategories = [...bySub]
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.subcategoryName.localeCompare(b.subcategoryName))
      .slice(0, 3);

    const { balance: balanceAtLastImport, importDate: balanceImportDate } =
      this.computeCurrentBalance(card.id, importBatches);

    return {
      card, cycleWindow, totalExpenses, totalPayments,
      transactionCount: cycleTxns.length,
      topSubcategories,
      balanceAtLastImport,
      balanceImportDate: balanceImportDate ?? '',
    };
  }

  private groupBySubcategory(
    transactions: Transaction[],
    subcategories: Subcategory[],
    categories: Category[]
  ): SubcategoryTotal[] {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (!t.subcategoryId) continue;
      map.set(t.subcategoryId, (map.get(t.subcategoryId) ?? 0) + t.decAmountPen);
    }
    return Array.from(map.entries())
      .map(([id, total]) => {
        const sub = subcategories.find(s => s.id === id);
        const cat = sub ? categories.find(c => c.id === sub.categoryId) : undefined;
        return { subcategoryId: id, subcategoryName: sub?.strName ?? '(unknown)', categoryName: cat?.strName ?? '(unknown)', total };
      })
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.subcategoryName.localeCompare(b.subcategoryName));
  }
}
```

---

## 8. Angular Module and Component Structure

```
src/
├── app/
│   ├── application/
│   │   ├── app.component.ts
│   │   ├── app.component.html
│   │   ├── app.routes.ts
│   │   └── app.routes.catalog.ts
│   │
│   ├── core/
│   │   ├── models/
│   │   │   ├── base.model.ts
│   │   │   ├── credit-card.model.ts
│   │   │   ├── debit-account.model.ts
│   │   │   ├── transaction.model.ts
│   │   │   ├── import-batch.model.ts          ← includes RawImportRow, ParseFileResult
│   │   │   ├── category.model.ts
│   │   │   ├── category-rule.model.ts
│   │   │   ├── duplication-collection.model.ts
│   │   │   ├── cycle-snapshot.model.ts
│   │   │   ├── cycle-close.model.ts
│   │   │   ├── recurrent-transaction.model.ts ← includes RecurrentStatus type
│   │   │   ├── recurrent-transaction-match.model.ts
│   │   │   └── app-settings.model.ts          ← NEW
│   │   │
│   │   ├── services/
│   │   │   ├── storage.service.ts             ← StorageWriteError; try-catch persist
│   │   │   ├── storage-keys.ts                ← SETTINGS_KEY added
│   │   │   ├── settings.service.ts            ← NEW §6.9
│   │   │   ├── excel-parser.service.ts        ← ParseValidationError; ParseFileResult
│   │   │   ├── duplication-logic.service.ts   ← accountId param; float tolerance; P2 flag
│   │   │   ├── category-matching.service.ts   ← unchanged
│   │   │   ├── conciliation-calculator.service.ts ← daysInMonth; PENDING post-close
│   │   │   ├── recurrent-matching.service.ts  ← buildTargetDate day clamping
│   │   │   └── dashboard-calculator.service.ts ← computeCurrentBalance; updated signatures
│   │   │
│   │   └── components/
│   │       └── storage-warning-banner/
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── confirm-dialog/
│   │   │   │   ├── confirm-dialog.component.ts   ← generic MatDialog confirm
│   │   │   │   └── confirm-dialog.component.html
│   │   │   └── amount-display/
│   │   │       └── amount-display.component.ts
│   │   └── pipes/
│   │       └── currency-pen.pipe.ts
│   │
│   ├── layout/
│   │   ├── shell/
│   │   │   ├── shell.component.ts
│   │   │   └── shell.component.html    ← sidenav + router-outlet
│   │   └── sidenav/
│   │       └── sidenav.component.ts    ← routerLinkActive="active" on all links
│   │
│   └── features/
│       ├── credit-cards/               ← lazy-loaded
│       │   ├── services/credit-card.service.ts   ← deleteWithCascade
│       │   └── pages/
│       │       ├── card-list/          ← empty state; confirm on delete
│       │       └── card-form/          ← intClosingDay/intPaymentDay validation (1–31)
│       │
│       ├── transactions/               ← lazy-loaded
│       │   ├── services/transaction.service.ts   ← getNonDeleted; clearSubcategoryRef
│       │   └── pages/
│       │       ├── transaction-list/   ← filter by account, status, date range; empty state
│       │       └── transaction-detail/
│       │
│       ├── import/                     ← lazy-loaded
│       │   ├── services/import-batch.service.ts  ← getLatestForAccount
│       │   ├── guards/
│       │   │   └── import-wizard.guard.ts        ← CanDeactivate
│       │   ├── state/
│       │   │   └── import-wizard.state.ts        ← pendingDeletions field added
│       │   └── pages/
│       │       ├── import-wizard/      ← MatStepper header; CanDeactivate guard
│       │       ├── step-upload/        ← file guards; spinner; multi-sheet banner
│       │       ├── step-review/        ← deletion intent; back button; P2 badge
│       │       └── step-finalize/      ← confirm dialog; try-catch; account-type routing
│       │
│       ├── categories/                 ← lazy-loaded
│       │   ├── services/
│       │   │   ├── category.service.ts          ← cascade delete; saveRule uniqueness
│       │   │   └── duplication-collection.service.ts
│       │   └── pages/
│       │       ├── category-list/      ← confirm on subcategory/category delete
│       │       ├── category-rule-list/ ← drag-to-reorder + up/down arrows (accessibility)
│       │       └── duplication-collection-list/
│       │
│       ├── conciliation/               ← lazy-loaded
│       │   └── pages/
│       │       ├── conciliation-form/  ← duplicate-cycle guard; first-cycle note
│       │       └── conciliation-history/ ← empty state
│       │
│       ├── debit-accounts/             ← lazy-loaded
│       │   ├── services/debit-account.service.ts ← deleteWithCascade
│       │   └── pages/
│       │       ├── debit-account-list/ ← empty state; confirm on delete
│       │       └── debit-account-form/ ← no balance field (balance from ImportBatch)
│       │
│       ├── recurrent-transactions/     ← lazy-loaded
│       │   ├── services/recurrent-transaction.service.ts ← deleteWithMatches; deleteMatch
│       │   └── pages/
│       │       ├── recurrent-list/
│       │       ├── recurrent-form/     ← AUTOMATIC required fields enforced
│       │       └── recurrent-dashboard/ ← 2 iterations; NOT_CONFIGURED; Unlink; bulk done
│       │
│       ├── explorer/                   ← lazy-loaded
│       │   └── pages/
│       │       └── transaction-explorer/ ← text + date + amount filters; aggregate row
│       │
│       ├── dashboard/                  ← lazy-loaded
│       │   └── pages/
│       │       ├── monthly-dashboard/  ← month-nav fix; future-block; transfers toggle
│       │       └── cycle-dashboard/    ← computed balance; reactive; PENDING; stable sort
│       │
│       └── settings/                   ← lazy-loaded (NEW)
│           └── pages/
│               └── app-settings/       ← P2 rule toggle and future settings
```

### Route catalog

```typescript
// src/app/application/app.routes.catalog.ts
export const ROUTES = {
  CREDIT_CARDS:            'credit-cards',
  TRANSACTIONS:            'transactions',
  IMPORT:                  'import',
  CATEGORIES:              'categories',
  CATEGORY_RULES:          'categories/rules',
  DUPLICATION_COLLECTIONS: 'categories/duplications',
  CONCILIATION:            'conciliation',
  DEBIT_ACCOUNTS:          'debit-accounts',
  RECURRENT_TRANSACTIONS:  'recurrent-transactions',
  RECURRENT_DASHBOARD:     'recurrent-transactions/dashboard',
  EXPLORER:                'explorer',
  DASHBOARD_MONTHLY:       'dashboard/monthly',
  DASHBOARD_CYCLE:         'dashboard/cycle',
  SETTINGS:                'settings',               // NEW
} as const;
```

---

## 9. Import Wizard — Data Flow

Three steps: **Upload → Review → Finalize**. No localStorage writes until Step 3.

### Wizard state

```typescript
// src/app/features/import/state/import-wizard.state.ts
export interface ImportWizardState {
  accountId: string | null;
  accountType: AccountType | null;
  currentBalance: number | null;
  usdExchangeRate: number | null;
  annotatedRows: AnnotatedImportRow[];
  contextTransactions: string[];   // ids of context transactions (5 days before)
  pendingDeletions: string[];      // ids staged for softDelete; applied on Step 2 → Step 3
}
```

### Step 1 — Upload (`StepUploadComponent`)

1. Account selector: `<mat-select>` with `<mat-optgroup>` separating "Credit Cards" and "Debit Accounts".
2. File input: `<input type="file" accept=".xlsx">`.
3. Balance field (required, positive number).
4. Exchange rate field (always shown, default 1.00; **required > 0 when file has USD rows**).
5. On file select: immediately validate extension and size — show inline error if invalid.
6. Show `MatProgressSpinner` while `parseFile()` runs.
7. If `hasMultipleSheets`: show info banner.
8. If 0 valid rows: show error; disable "Next".
9. On "Next" (validation passed):
   - `DuplicationLogicService.annotate(rows, allTransactions, collections, accountId, accountType, settings.boolP2RuleEnabled)`
   - `CategoryMatchingService.match(desc, rules)` for each row.
   - Compute context transactions (earliest date − 5 days window).
   - `ImportWizardStateService.patch(...)`.
   - Navigate to `/import/review`.

### Step 2 — Review (`StepReviewComponent`)

**CanDeactivate guard (`ImportWizardGuard`):** If `state.annotatedRows.length > 0` and the user navigates away (sidenav, browser back, router link), open `MatDialog` confirm before allowing navigation.

Display:
- Rows grouped by `dateTransaction` DESC.
- AUTO_DUPLICATE: unchecked + disabled + grayed.
- If **all** rows are AUTO_DUPLICATE: show info banner "All N rows detected as duplicates — nothing to import."
- POTENTIAL_DUPLICATE (P1/P3): highlighted; matching transaction shown inline.
- P2-flagged rows: additionally labeled with a "P2" badge + tooltip.
- Context menu per row: "Add note" | "Mark as Pending".
- Context transactions (below): each with trash icon.

Deletion intent:
- Clicking trash icon: `state.pendingDeletions = [...current, txnId]`. Transaction shown struck-through in UI.
- Clicking again: remove id from `pendingDeletions` (undo).

On "← Back": `ImportWizardStateService.reset()`; navigate to Step 1.

On "Next →":
1. Flush all row state changes (subcategoryId, note, pendingFlag) to `ImportWizardStateService`.
2. Apply pending deletions: `for (id of state.pendingDeletions) transactionService.softDelete(id)`.
3. Navigate to `/import/finalize`.

### Step 3 — Finalize (`StepFinalizeComponent`)

Read-only summary. On "Save & Finish":

1. Open confirm dialog: *"Import N transactions into [Account Name]? This cannot be undone."*
2. Try block:
   ```typescript
   const batch = importBatchService.save({
     accountId, accountType,
     dateImport: todayDate,
     decUsdExchangeRate: usdExchangeRate,
     decBalanceAtImport: accountType === 'CREDIT_CARD' ? -Math.abs(currentBalance) : Math.abs(currentBalance),
   });

   const checkedRows = annotatedRows.filter(r => r.checked);
   transactionService.saveMany(checkedRows.map(row => ({
     accountId, accountType,
     importBatchId: batch.id,
     dateTransaction:    row.raw.dateTransaction,
     strDescription:     row.raw.description,
     strCurrency:        row.raw.currency,
     decAmount:          row.raw.amount,
     decAmountPen:       row.raw.amountPen,
     subcategoryId:      row.subcategoryId,
     strNotes:           row.note,
     strOperationNumber: row.raw.strOperationNumber,
     strStatus:          row.pendingFlag ? 'PENDING' : 'ACTIVE',
   })));

   // Automatic recurrent matching
   const allActive = transactionService.getActive();
   const newMatches = recurrentMatchingService.findAutomaticMatches(
     recurrents, existingMatches, allActive, todayDate
   );
   for (const result of newMatches) {
     recurrentTransactionService.saveMatch({ ...result, boolDone: true, strMatchMode: 'AUTOMATIC' });
   }
   ```
3. Catch `StorageWriteError`: show toast "Save failed — storage quota exceeded."; abort (no further navigation).
4. On success:
   - Check storage; warn if > 4 MB.
   - `importWizardStateService.reset()`.
   - Show success toast: *"Import complete — N transactions saved."*
   - Navigate: credit card → `ROUTES.CONCILIATION`; debit account → `ROUTES.TRANSACTIONS`.

**localStorage writes:**

| Key | Action |
|---|---|
| `pfmg_import_batches` | 1 new ImportBatch |
| `pfmg_transactions` | N new Transaction records |
| `pfmg_recurrent_matches` | 0–N new match records |
| `pfmg_transactions` (Step 2) | M soft-deletes (pendingDeletions) |

---

## 10. Conciliation UI Flow

**Route:** `ROUTES.CONCILIATION`

### Form inputs

1. Select credit card.
2. Enter current balance (positive number).
3. Auto-display computed cycle window.
4. "Calculate" → `ConciliationCalculatorService.calculate(input)` where `input.nonDeletedTransactions = transactionService.getNonDeleted().filter(t => t.accountId === cardId)`.

### Preview display

| Label | Value |
|---|---|
| Opening balance | `result.openingBalance` |
| Cycle movements | `result.cycleMovementsSum` |
| Amount A (expected closing) | `result.amountA` |
| Current balance (negated) | `result.currentBalanceNegated` |
| Post-close movements | `result.postCloseMovementsSum` |
| Amount B (implied closing) | `result.amountB` |
| **Interest / Discrepancy** | `result.interestAmount` (red if ≠ 0) |

**First-cycle info note:** If `conciliationService.getMostRecentCycleClose(cardId)` returns `undefined`, show: *"First reconciliation for this card — opening balance assumed 0. If the card had an existing balance before this import, adjust the interest amount manually."*

### On "Confirm"

1. **Duplicate-cycle guard:** if `conciliationService.existsCycleClose(cardId, window.closingDate)`, show confirm dialog: *"A cycle close already exists for [date]. Overwrite?"* — on cancel, stop.
2. If `interestAmount !== 0`: `transactionService.save({ ... strDescription: 'INTERES', dateTransaction: closingDate, ... })`.
3. `conciliationService.saveCycleClose(...)`.
4. `conciliationService.saveCycleSnapshot(...)`.
5. Check storage; warn if > 4 MB.
6. Show success toast: *"Cycle closed. Discrepancy recorded: S/ X.XX"*.
7. Navigate to conciliation history for the card.

**Empty state:** Conciliation history page shows: *"No cycle closes recorded yet. Run a reconciliation to start tracking cycles."*

---

## 11. Recurrent Dashboard — UI Flow

**Route:** `ROUTES.RECURRENT_DASHBOARD`

### Data loaded

```typescript
recurrents    = recurrentTransactionService.getAll();
allMatches    = recurrentTransactionService.getAllMatches();
activeTransactions = transactionService.getActive();
todayDate     = new Date().toISOString().slice(0, 10);
```

### Iteration keys

For each recurrent, compute **last 2 iteration keys**:

```typescript
function getIterationKeys(r: RecurrentTransaction, todayDate: string): string[] {
  if (r.strFrequency === 'MONTHLY') {
    const current = todayDate.slice(0, 7);
    const [y, m] = current.split('-').map(Number);
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const previous = `${prevY}-${String(prevM).padStart(2, '0')}`;
    return [current, previous];
  }
  const current = todayDate.slice(0, 4);
  return [current, String(Number(current) - 1)];
}
```

### Status computation per iteration

```typescript
type RecurrentStatus = 'DONE' | 'PENDING' | 'NOT_YET_DUE' | 'NOT_CONFIGURED';

function computeStatus(r, iterationKey, matches, todayDate): RecurrentStatus {
  const match      = matches.find(m => m.recurrentTransactionId === r.id && m.strIterationKey === iterationKey);
  if (match?.boolDone) return 'DONE';

  const targetDate = buildTargetDate(r, iterationKey); // from RecurrentMatchingService
  if (!targetDate) return 'NOT_CONFIGURED';             // MANUAL with no intApproxDay

  const dayRange = r.intDayRange ?? 0;
  const target   = new Date(targetDate);
  const today    = new Date(todayDate);
  const windowOpen = new Date(target.getTime() - dayRange * 86_400_000);

  return today < windowOpen ? 'NOT_YET_DUE' : 'PENDING';
}
```

### Display

Sort order: PENDING → NOT_YET_DUE → NOT_CONFIGURED → DONE.

Each recurrent shows 2 rows (current + previous iteration):

| Column | Value |
|---|---|
| Name | `r.strName` |
| Account | resolved name |
| Frequency | `MONTHLY` / `YEARLY` |
| Iteration | iteration key |
| Expected date | `targetDate` or "—" |
| Status badge | DONE (green) / PENDING (amber) / NOT_YET_DUE (gray) / NOT_CONFIGURED (muted) |
| Matched on | DONE only: `match.dateDone` |

Previous-iteration row: muted if DONE; red if PENDING (missed).

### Actions

| Row state | Actions |
|---|---|
| PENDING (current) | "Mark as done" · "Link transaction" |
| DONE (current or previous) | "Unlink / Undo" |
| All PENDING (bulk) | "Mark all as done" button in header |

**"Mark as done":** `recurrentTransactionService.saveMatch({ ..., boolDone: true, strMatchMode: 'MANUAL', transactionId: undefined })`. Show toast.

**"Link transaction":** Opens `MatDialog` listing ACTIVE transactions for `r.accountId` sorted by date DESC. User selects → save match with `transactionId`. Show toast.

**"Unlink / Undo":** `recurrentTransactionService.deleteMatch(match.id)`. Show toast.

**"Mark all as done":** Iterates all PENDING rows for `currentIterationKey` → `saveMatch` for each.

**Empty state:** *"No recurring transactions configured. Add them in Recurrent Transactions →"*

---

## 12. Transaction Explorer — UI Flow

**Route:** `ROUTES.EXPLORER`

### Filter panel

```
[ Category ▼ ]   [ Subcategory ▼ ]   [ Account ▼ ]   [ Search description... ]
[ Date from ]   [ Date to ]   [ Amount min ]   [ Amount max ]
```

All filters update results reactively (no search button needed).

### Results filtering

```typescript
let results = transactionService.getAll().filter(t => t.strStatus !== 'DELETED');

if (selectedSubcategoryId) results = results.filter(t => t.subcategoryId === selectedSubcategoryId);
if (selectedAccountId)     results = results.filter(t => t.accountId === selectedAccountId);
if (textSearch)            results = results.filter(t => t.strDescription.toLowerCase().includes(textSearch.toLowerCase()));
if (dateFrom)              results = results.filter(t => t.dateTransaction >= dateFrom);
if (dateTo)                results = results.filter(t => t.dateTransaction <= dateTo);
if (amountMin != null)     results = results.filter(t => Math.abs(t.decAmountPen) >= amountMin);
if (amountMax != null)     results = results.filter(t => Math.abs(t.decAmountPen) <= amountMax);

results = results.sort by dateTransaction DESC;
```

### Results list columns

| Column | Value |
|---|---|
| Date | `t.dateTransaction` via `DatePipe` (`'dd/MM/yyyy'`) |
| Account | resolved name |
| Description | `t.strDescription` |
| Amount | `t.decAmountPen` via `CurrencyPenPipe` (red/green) |
| Status | ACTIVE / PENDING badge |

### Aggregate row

Below the list: **"N transactions · Total: S/ X.XX"** (sum of `decAmountPen`, colored by sign).

### Empty states

- No category selected: *"Select a category to start exploring."*
- Category selected, no subcategory: *"Select a subcategory to see transactions."*
- No results: *"No transactions found for this subcategory."*

No localStorage writes in this feature.

---

## 13. Monthly Dashboard — Data Flow

**Route:** `ROUTES.DASHBOARD_MONTHLY`

### Month navigation

```typescript
// CORRECT month arithmetic — never naive string manipulation
function changeMonth(current: string, delta: number): string {
  const [y, m] = current.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
```

- Default: current month.
- "Next →" disabled when `selectedMonth >= currentMonth` (no future navigation).

### Data computation

```typescript
const data = dashboardCalculatorService.computeMonthly(
  selectedMonth,
  transactionService.getAll(),
  categoryService.getSubcategories(),
  categoryService.getCategories(),
  hideTransfers   // from toggle in component
);
```

Component subscribes to `transactionService.transactions$` and recomputes on every emission.

### Display

**Controls row:** month navigation + "Hide transfers" toggle (defaults off).

**Summary row:**

| Income | Expenses | Net |
|---|---|---|
| `data.totalIncome` (green) | `abs(data.totalExpenses)` (red) | `data.netAmount` (colored) |

**PENDING footnote** (shown if `data.pendingCount > 0`):
> *\* Includes N pending transactions (S/ X.XX)*

**Subcategory breakdown table** (sorted by `abs(total)` DESC, stable):

| Category | Subcategory | Total (PEN) |
|---|---|---|
| Alimentación | Supermercado | −350.00 |
| … | … | … |
| *(Uncategorized — income)* | — | `uncategorizedIncome` (green) |
| *(Uncategorized — expenses)* | — | `uncategorizedExpenses` (red) |

---

## 14. Cycle Dashboard — Data Flow

**Route:** `ROUTES.DASHBOARD_CYCLE`

### Data computation

Component subscribes to `transactionService.transactions$`. On every emission:

```typescript
const todayDate = new Date().toISOString().slice(0, 10);
const cards       = creditCardService.getAll();
const txns        = transactionService.getAll();
const batches     = importBatchService.getAll();
const subs        = categoryService.getSubcategories();
const cats        = categoryService.getCategories();

cardSummaries = cards.map(card =>
  dashboardCalculatorService.computeCycleSummary(card, todayDate, txns, batches, subs, cats)
);
```

### Display

**Empty state (no cards):** *"No credit cards configured. Add one to see cycle summaries →"*

One widget per card:

```
┌──────────────────────────────────────────────┐
│  BCP Visa Gold                               │
│  Cycle: 16/04/2026 → 15/05/2026              │
│                                              │
│  Expenses     S/ −1,250.50                   │
│  Payments        S/ 500.00                   │
│  Balance at last import: S/ −750.50          │
│    (as of 10/05/2026)                        │
│                                              │
│  Top spending:                               │
│    Supermercado      −350.00                 │
│    Restaurantes      −210.00                 │
│    Streaming          −89.90                 │
│  (12 transactions)                           │
└──────────────────────────────────────────────┘
```

- **Balance:** `data.balanceAtLastImport` labeled *"Balance at last import (as of DATE)"*.
- **No transactions in current cycle:** *"No transactions in current cycle (DATE → DATE)."*
- **Top subcategories:** up to 3 rows, sorted `abs(total)` DESC then name ASC.
- PENDING transactions are **included** (consistent with monthly dashboard).

---

## 15. localStorage Size Considerations

Approximate estimate at ~1 000 transactions (the target max):

| Collection | Records | ~Bytes each | ~Total |
|---|---|---|---|
| pfmg_transactions | 1 000 | 500 B | 500 KB |
| pfmg_import_batches | 20 | 300 B | 6 KB |
| pfmg_recurrent_matches | 200 | 250 B | 50 KB |
| Other collections | — | — | ~50 KB |
| **Total** | | | **~600 KB** |

At 1 000 transactions the app uses roughly 600 KB — well within the 5–10 MB browser quota. The storage warning threshold (4 MB) will not be reached at this scale. The warning banner is retained as a safety net.

```typescript
const WARN_THRESHOLD_BYTES = 4 * 1024 * 1024;

if (storageService.getTotalBytes() > WARN_THRESHOLD_BYTES) {
  storageWarningService.show();
}
```

---

## 16. Migration Path to Backend

When the UI is stable and ready to connect to the real backend, only the **feature services** change. All business logic services, components, and templates remain identical.

### What changes

Each feature service currently calls `StorageService`. Replace those calls with `HttpClient` calls to the corresponding API endpoints. The `Observable`-based component bindings require no changes.

### What does NOT change

| Layer | Change needed |
|---|---|
| `ExcelParserService` | None — parsing is always browser-side |
| `DuplicationLogicService` | None — pure TypeScript |
| `CategoryMatchingService` | None — pure TypeScript |
| `ConciliationCalculatorService` | None — pure TypeScript |
| `RecurrentMatchingService` | None — pure TypeScript |
| `DashboardCalculatorService` | None — pure TypeScript |
| All feature components | None — they bind to Observable streams |
| All templates | None |
| `ImportWizardStateService` | None |
| TypeScript interfaces/models | None |
| `SettingsService` | May be replaced by user preferences API; minimal change |

### Migration checklist

1. Add `provideHttpClient()` to app configuration.
2. For each feature service: replace `StorageService` injection with `HttpClient`.
3. Swap synchronous `getAll()` returns for `Observable<T[]>` from HTTP GET.
4. Update refresh trigger from `storage.changes$` to post-mutation HTTP reload or WebSocket events.
5. Remove `StorageService`, `STORAGE_KEYS`, `SETTINGS_KEY` once all services are migrated.
6. Remove `StorageWarningBannerComponent`.
7. `decCurrentBalance` remains absent — the backend will derive balance from transactions or provide a dedicated balance endpoint.
