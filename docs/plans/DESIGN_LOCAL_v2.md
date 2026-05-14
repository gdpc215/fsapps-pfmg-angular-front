# Credit Card Transaction Tracking System — Local-Only Design Document

**Version:** 1.1  
**Date:** 2026-05-12  
**Project:** fsapps-pfmg  
**Variant:** Pure Angular frontend with localStorage persistence (no backend, no HTTP)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [TypeScript Interfaces (All Entities)](#3-typescript-interfaces-all-entities)
4. [localStorage Schema](#4-localstorage-schema)
5. [StorageService](#5-storageservice)
6. [Feature Services](#6-feature-services)
   - [6.1 CreditCardService](#61-creditcardservice)
   - [6.2 TransactionService](#62-transactionservice)
   - [6.3 ImportBatchService](#63-importbatchservice)
   - [6.4 CategoryService](#64-categoryservice)
   - [6.5 ConciliationService](#65-conciliationservice)
   - [6.6 DuplicationCollectionService](#66-duplicationcollectionservice)
   - [6.7 DebitAccountService](#67-debitaccountservice)
   - [6.8 RecurrentTransactionService](#68-recurrenttransactionservice)
7. [Business Logic Services](#7-business-logic-services)
   - [7.1 ExcelParserService](#71-excelparserservice)
   - [7.2 DuplicationLogicService](#72-duplicationlogicservice)
   - [7.3 CategoryMatchingService](#73-categorymatchingservice)
   - [7.4 ConciliationCalculatorService](#74-conciliationcalculatorservice)
   - [7.5 RecurrentMatchingService](#75-recurrentmatchingservice)
8. [Angular Module and Component Structure](#8-angular-module-and-component-structure)
9. [Import Wizard — Data Flow](#9-import-wizard--data-flow)
10. [Conciliation UI Flow](#10-conciliation-ui-flow)
11. [localStorage Size Considerations](#11-localstorage-size-considerations)
12. [Migration Path to Backend](#12-migration-path-to-backend)

---

## 1. Overview

This variant of the design runs entirely in the browser. All data is persisted in `localStorage` as JSON-serialized arrays. There is no backend, no HTTP calls, and no server-side business logic.

The primary purpose of this variant is to enable fast iteration on UI/UX changes without requiring any backend infrastructure to be running locally. Once the UI is stable, the services can be swapped to call a real backend API following the full design in `DESIGN.md`.

Core capabilities are identical to the full-stack design:

- Multi-card management with per-card closing-day configuration
- Excel import with browser-side SheetJS parsing, duplication detection, and auto-categorization
- Category and rule management
- Cycle-based reconciliation with interest detection
- Soft-delete on transactions (strStatus flag)
- Multi-account management: credit cards (with cycle conciliation) and debit accounts (savings, no conciliation)
- Recurrent transaction tracking for known monthly/yearly charges, with manual or automatic matching

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
  dateModification: string;  // ISO 8601, updated by StorageService on every save
}
```

```typescript
// src/app/core/models/credit-card.model.ts
import { BaseEntity } from './base.model';

export interface CreditCard extends BaseEntity {
  strName: string;
  intClosingDay: number;      // 1–31
  intPaymentDay: number;      // 1–31
  decCurrentBalance: number;  // last calculated balance (negative = owed); updated after every import and conciliation
}
```

```typescript
// src/app/core/models/debit-account.model.ts
import { BaseEntity } from './base.model';

export interface DebitAccount extends BaseEntity {
  strName: string;
  decCurrentBalance: number;  // last calculated balance; updated after every import
}
```

```typescript
// src/app/core/models/transaction.model.ts
import { BaseEntity } from './base.model';

export type TransactionCurrency = 'PEN' | 'USD';
export type TransactionStatus = 'ACTIVE' | 'DELETED' | 'PENDING';
export type AccountType = 'CREDIT_CARD' | 'DEBIT_ACCOUNT';

export interface Transaction extends BaseEntity {
  accountId: string;             // references CreditCard.id or DebitAccount.id
  accountType: AccountType;
  importBatchId?: string;        // nullable; null for manually created transactions
  dateTransaction: string;       // YYYY-MM-DD
  strDescription: string;
  strCurrency: TransactionCurrency;
  decAmount: number;             // negative = charge, positive = payment/refund
  decAmountPen: number;          // always in PEN; USD rows = decAmount × exchange rate
  subcategoryId?: string;        // nullable
  strNotes?: string;             // nullable
  strStatus: TransactionStatus;
  strOperationNumber?: string;   // debit accounts only; set from Excel; used for auto-dupe detection rule D1
  transferGroupId?: string;      // shared ID linking two transactions that form a transfer (debit→debit or debit→credit)
}
```

```typescript
// src/app/core/models/import-batch.model.ts
import { BaseEntity } from './base.model';
import { AccountType } from './transaction.model';

export interface ImportBatch extends BaseEntity {
  accountId: string;            // references CreditCard.id or DebitAccount.id
  accountType: AccountType;
  dateImport: string;           // YYYY-MM-DD
  decUsdExchangeRate: number;   // PEN per 1 USD at import time; always provided even for PEN-only files
  decBalanceAtImport: number;   // negative = owed (credit) or current balance (debit)
}
```

```typescript
// src/app/core/models/category.model.ts
import { BaseEntity } from './base.model';

export interface Category extends BaseEntity {
  strName: string;
}

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
  intPriority: number; // lower = higher priority; first match wins
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

export type RecurrenceFrequency = 'MONTHLY' | 'YEARLY';
export type RecurrenceMatchMode = 'MANUAL' | 'AUTOMATIC';

export interface RecurrentTransaction extends BaseEntity {
  strName: string;
  strNotes?: string;
  accountId: string;              // CreditCard.id or DebitAccount.id
  accountType: AccountType;
  strFrequency: RecurrenceFrequency;
  strMatchMode: RecurrenceMatchMode;
  // --- Automatic matching fields; all undefined for MANUAL mode ---
  strCurrency?: TransactionCurrency;
  decApproxAmount?: number;       // expected amount (negative = charge, positive = payment)
  decAmountRange?: number;        // tolerance; match if abs(t.decAmount) ∈ [abs(approx)−range, abs(approx)+range]
  strMatchString?: string;        // case-insensitive CONTAINS match on strDescription
  intApproxDay?: number;          // target day of month (MONTHLY) or day of specific month (YEARLY)
  intApproxMonth?: number;        // 1–12; YEARLY only; undefined for MONTHLY
  intDayRange?: number;           // ±days tolerance around the target date
}
```

```typescript
// src/app/core/models/recurrent-transaction-match.model.ts
import { BaseEntity } from './base.model';
import { RecurrenceMatchMode } from './recurrent-transaction.model';

export interface RecurrentTransactionMatch extends BaseEntity {
  recurrentTransactionId: string;
  strIterationKey: string;        // 'YYYY-MM' for MONTHLY (e.g. '2026-05'), 'YYYY' for YEARLY (e.g. '2026')
  transactionId?: string;         // linked Transaction.id; undefined if manually marked done without linking
  boolDone: boolean;
  dateDone?: string;              // YYYY-MM-DD when marked done
  strMatchMode: RecurrenceMatchMode; // 'MANUAL' | 'AUTOMATIC'
}
```

```typescript
// src/app/core/models/cycle-snapshot.model.ts
import { BaseEntity } from './base.model';

export type SnapshotType = 'SNAPSHOT' | 'CYCLE_CLOSE';

export interface CycleSnapshot extends BaseEntity {
  cardId: string;
  dateSnapshot: string;          // YYYY-MM-DD
  decBalanceAtSnapshot: number;  // negative = owed
  strType: SnapshotType;
}
```

```typescript
// src/app/core/models/cycle-close.model.ts
import { BaseEntity } from './base.model';

export interface CycleClose extends BaseEntity {
  cardId: string;
  dateClosing: string;            // YYYY-MM-DD (the closing day D)
  decOpeningBalance: number;      // from previous CycleClose.decClosingBalance or 0
  decClosingBalance: number;      // amountB from reconciliation formula
  decInterestAmount: number;      // 0 if no interest
  interestTransactionId?: string; // nullable; id of the generated interest Transaction
}
```

---

## 4. localStorage Schema

Each domain collection is stored under a dedicated key. Values are JSON-serialized arrays of the corresponding entity. Keys are namespaced with the prefix `pfmg_` to avoid collisions with other apps running on the same origin.

| Key | Entity type | Description |
|---|---|---|
| `pfmg_credit_cards` | `CreditCard[]` | All registered credit cards |
| `pfmg_debit_accounts` | `DebitAccount[]` | All registered debit/savings accounts |
| `pfmg_transactions` | `Transaction[]` | All transactions (including DELETED) |
| `pfmg_import_batches` | `ImportBatch[]` | One record per Excel import event |
| `pfmg_categories` | `Category[]` | Top-level categories |
| `pfmg_subcategories` | `Subcategory[]` | Subcategories linked to a category |
| `pfmg_category_rules` | `CategoryRule[]` | Matching rules for auto-categorization |
| `pfmg_duplication_collections` | `DuplicationCollection[]` | Named string sets for P3 duplication detection |
| `pfmg_cycle_snapshots` | `CycleSnapshot[]` | Mid-cycle and cycle-close balance snapshots |
| `pfmg_cycle_closes` | `CycleClose[]` | Finalized cycle reconciliation records |
| `pfmg_recurrent_transactions` | `RecurrentTransaction[]` | Configured recurrent transaction templates |
| `pfmg_recurrent_matches` | `RecurrentTransactionMatch[]` | Per-iteration match records |

### Serialized shape example

```json
// localStorage key: pfmg_transactions
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "card-uuid-1",
    "accountType": "CREDIT_CARD",
    "importBatchId": "batch-uuid-1",
    "dateTransaction": "2026-04-15",
    "strDescription": "SUPERMERCADO WONG",
    "strCurrency": "PEN",
    "decAmount": -120.50,
    "decAmountPen": -120.50,
    "subcategoryId": "subcat-uuid-5",
    "strNotes": null,
    "strStatus": "ACTIVE",
    "dateCreation": "2026-05-01T14:32:00.000Z",
    "dateModification": "2026-05-01T14:32:00.000Z"
  }
]
```

```json
// localStorage key: pfmg_credit_cards
[
  {
    "id": "card-uuid-1",
    "strName": "BCP Visa Gold",
    "intClosingDay": 15,
    "intPaymentDay": 5,
    "decCurrentBalance": -1250.00,
    "dateCreation": "2026-04-01T10:00:00.000Z",
    "dateModification": "2026-04-01T10:00:00.000Z"
  }
]
```

```json
// localStorage key: pfmg_debit_accounts
[
  {
    "id": "debit-uuid-1",
    "strName": "BCP Cuenta de Ahorros",
    "decCurrentBalance": 5400.50,
    "dateCreation": "2026-04-01T10:00:00.000Z",
    "dateModification": "2026-05-01T10:00:00.000Z"
  }
]
```

---

## 5. StorageService

`StorageService` is the single point of contact with `localStorage`. No other service or component accesses `localStorage` directly.

```typescript
// src/app/core/services/storage.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class StorageService {

  /** Emits void whenever any collection is modified. Feature services subscribe
   *  to this to refresh their BehaviorSubject streams. */
  readonly changes$ = new BehaviorSubject<void>(undefined);

  // ------------------------------------------------------------------ read

  getAll<T>(key: string): T[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      console.error(`StorageService: failed to parse key "${key}"`);
      return [];
    }
  }

  // ------------------------------------------------------------------ write

  /** Insert or update a record.
   *  - If record has no id, one is generated with crypto.randomUUID().
   *  - dateCreation is set only on insert (when the record is not found by id).
   *  - dateModification is always updated to now.
   *  Returns the saved record (with id and timestamps populated). */
  save<T extends { id?: string; dateCreation?: string; dateModification?: string }>(
    key: string,
    record: T
  ): T {
    const all = this.getAll<T>(key);
    const now = new Date().toISOString();

    let saved: T;

    if (!record.id) {
      // INSERT
      saved = {
        ...record,
        id: crypto.randomUUID(),
        dateCreation: now,
        dateModification: now,
      };
      all.push(saved);
    } else {
      // UPDATE
      const idx = all.findIndex((item: any) => item.id === record.id);
      saved = { ...record, dateModification: now };
      if (idx === -1) {
        saved = { ...saved, dateCreation: now };
        all.push(saved);
      } else {
        // Preserve original dateCreation
        saved = { ...(all[idx] as any), ...saved, dateModification: now };
        all[idx] = saved;
      }
    }

    this.persist(key, all);
    return saved;
  }

  /** Hard-delete a record by id. For transactions, prefer setting strStatus = 'DELETED'. */
  delete(key: string, id: string): void {
    const all = this.getAll<{ id: string }>(key);
    const filtered = all.filter(item => item.id !== id);
    this.persist(key, filtered);
  }

  /** Replace the entire collection for a key. */
  saveAll<T>(key: string, records: T[]): void {
    this.persist(key, records);
  }

  /** Remove all records for a key. */
  clear(key: string): void {
    localStorage.removeItem(key);
    this.changes$.next();
  }

  // ------------------------------------------------------------------ private

  private persist<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
    this.changes$.next();
  }

  // ------------------------------------------------------------------ size

  /** Returns total localStorage usage in bytes (approximated via UTF-16). */
  getTotalBytes(): number {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      total += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
    return total;
  }
}
```

### StorageKeys constant

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
```

---

## 6. Feature Services

Each feature service injects `StorageService`, owns a `BehaviorSubject` for its collection, and re-emits on every write. Components bind to `service.items$` for reactive updates. Business rules are delegated to the logic services described in section 7.

### 6.1 CreditCardService

`decCurrentBalance` and `intPaymentDay` are required fields; `save()` must include both when creating or updating a card.

```typescript
// src/app/features/credit-cards/services/credit-card.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { CreditCard } from '../../../core/models/credit-card.model';

@Injectable({ providedIn: 'root' })
export class CreditCardService {
  private readonly _cards$ = new BehaviorSubject<CreditCard[]>([]);
  readonly cards$: Observable<CreditCard[]> = this._cards$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    // React to changes triggered from other services or tabs
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): CreditCard[] {
    return this._cards$.getValue();
  }

  getById(id: string): CreditCard | undefined {
    return this.getAll().find(c => c.id === id);
  }

  save(card: Partial<CreditCard>): CreditCard {
    const saved = this.storage.save<CreditCard>(STORAGE_KEYS.CREDIT_CARDS, card as CreditCard);
    return saved;
  }

  delete(id: string): void {
    this.storage.delete(STORAGE_KEYS.CREDIT_CARDS, id);
  }

  private refresh(): void {
    this._cards$.next(this.storage.getAll<CreditCard>(STORAGE_KEYS.CREDIT_CARDS));
  }
}
```

### 6.2 TransactionService

```typescript
// src/app/features/transactions/services/transaction.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { Transaction } from '../../../core/models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly _transactions$ = new BehaviorSubject<Transaction[]>([]);
  readonly transactions$: Observable<Transaction[]> = this._transactions$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): Transaction[] {
    return this._transactions$.getValue();
  }

  getActive(): Transaction[] {
    return this.getAll().filter(t => t.strStatus === 'ACTIVE');
  }

  getByCard(cardId: string): Transaction[] {
    return this.getAll().filter(t => t.accountId === cardId);
  }

  getActiveByCardAndDateRange(cardId: string, from: string, to: string): Transaction[] {
    return this.getActive().filter(
      t => t.accountId === cardId && t.dateTransaction >= from && t.dateTransaction <= to
    );
  }

  save(transaction: Partial<Transaction>): Transaction {
    const record = { strStatus: 'ACTIVE', ...transaction } as Transaction;
    return this.storage.save<Transaction>(STORAGE_KEYS.TRANSACTIONS, record);
  }

  saveMany(transactions: Partial<Transaction>[]): Transaction[] {
    const all = this.storage.getAll<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const now = new Date().toISOString();
    const saved: Transaction[] = transactions.map(t => ({
      strStatus: 'ACTIVE',
      ...t,
      id: (t as any).id ?? crypto.randomUUID(),
      dateCreation: now,
      dateModification: now,
    } as Transaction));
    this.storage.saveAll<Transaction>(STORAGE_KEYS.TRANSACTIONS, [...all, ...saved]);
    return saved;
  }

  softDelete(id: string): void {
    const t = this.getAll().find(x => x.id === id);
    if (t) {
      this.storage.save<Transaction>(STORAGE_KEYS.TRANSACTIONS, { ...t, strStatus: 'DELETED' });
    }
  }

  private refresh(): void {
    this._transactions$.next(this.storage.getAll<Transaction>(STORAGE_KEYS.TRANSACTIONS));
  }
}
```

### 6.3 ImportBatchService

```typescript
// src/app/features/import/services/import-batch.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { ImportBatch } from '../../../core/models/import-batch.model';

@Injectable({ providedIn: 'root' })
export class ImportBatchService {
  private readonly _batches$ = new BehaviorSubject<ImportBatch[]>([]);
  readonly batches$: Observable<ImportBatch[]> = this._batches$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): ImportBatch[] {
    return this._batches$.getValue();
  }

  save(batch: Partial<ImportBatch>): ImportBatch {
    return this.storage.save<ImportBatch>(STORAGE_KEYS.IMPORT_BATCHES, batch as ImportBatch);
  }

  delete(id: string): void {
    this.storage.delete(STORAGE_KEYS.IMPORT_BATCHES, id);
  }

  private refresh(): void {
    this._batches$.next(this.storage.getAll<ImportBatch>(STORAGE_KEYS.IMPORT_BATCHES));
  }
}
```

### 6.4 CategoryService

```typescript
// src/app/features/categories/services/category.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { Category, Subcategory } from '../../../core/models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly _categories$ = new BehaviorSubject<Category[]>([]);
  private readonly _subcategories$ = new BehaviorSubject<Subcategory[]>([]);

  readonly categories$: Observable<Category[]> = this._categories$.asObservable();
  readonly subcategories$: Observable<Subcategory[]> = this._subcategories$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getCategories(): Category[] { return this._categories$.getValue(); }
  getSubcategories(): Subcategory[] { return this._subcategories$.getValue(); }

  getSubcategoriesByCategoryId(categoryId: string): Subcategory[] {
    return this.getSubcategories().filter(s => s.categoryId === categoryId);
  }

  saveCategory(cat: Partial<Category>): Category {
    return this.storage.save<Category>(STORAGE_KEYS.CATEGORIES, cat as Category);
  }

  saveSubcategory(sub: Partial<Subcategory>): Subcategory {
    return this.storage.save<Subcategory>(STORAGE_KEYS.SUBCATEGORIES, sub as Subcategory);
  }

  deleteCategory(id: string): void {
    this.storage.delete(STORAGE_KEYS.CATEGORIES, id);
  }

  deleteSubcategory(id: string): void {
    this.storage.delete(STORAGE_KEYS.SUBCATEGORIES, id);
  }

  private refresh(): void {
    this._categories$.next(this.storage.getAll<Category>(STORAGE_KEYS.CATEGORIES));
    this._subcategories$.next(this.storage.getAll<Subcategory>(STORAGE_KEYS.SUBCATEGORIES));
  }
}
```

### 6.5 ConciliationService

```typescript
// src/app/features/conciliation/services/conciliation.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { CycleClose } from '../../../core/models/cycle-close.model';
import { CycleSnapshot } from '../../../core/models/cycle-snapshot.model';

@Injectable({ providedIn: 'root' })
export class ConciliationService {
  private readonly _cycleCloses$ = new BehaviorSubject<CycleClose[]>([]);
  private readonly _cycleSnapshots$ = new BehaviorSubject<CycleSnapshot[]>([]);

  readonly cycleCloses$: Observable<CycleClose[]> = this._cycleCloses$.asObservable();
  readonly cycleSnapshots$: Observable<CycleSnapshot[]> = this._cycleSnapshots$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getCycleCloses(): CycleClose[] { return this._cycleCloses$.getValue(); }
  getCycleSnapshots(): CycleSnapshot[] { return this._cycleSnapshots$.getValue(); }

  getMostRecentCycleClose(cardId: string): CycleClose | undefined {
    return this.getCycleCloses()
      .filter(cc => cc.cardId === cardId)
      .sort((a, b) => b.dateClosing.localeCompare(a.dateClosing))[0];
  }

  saveCycleClose(record: Partial<CycleClose>): CycleClose {
    return this.storage.save<CycleClose>(STORAGE_KEYS.CYCLE_CLOSES, record as CycleClose);
  }

  saveCycleSnapshot(record: Partial<CycleSnapshot>): CycleSnapshot {
    return this.storage.save<CycleSnapshot>(STORAGE_KEYS.CYCLE_SNAPSHOTS, record as CycleSnapshot);
  }

  private refresh(): void {
    this._cycleCloses$.next(this.storage.getAll<CycleClose>(STORAGE_KEYS.CYCLE_CLOSES));
    this._cycleSnapshots$.next(this.storage.getAll<CycleSnapshot>(STORAGE_KEYS.CYCLE_SNAPSHOTS));
  }
}
```

### 6.6 DuplicationCollectionService

```typescript
// src/app/features/categories/services/duplication-collection.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { DuplicationCollection } from '../../../core/models/duplication-collection.model';

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
    return this.storage.save<DuplicationCollection>(
      STORAGE_KEYS.DUPLICATION_COLLECTIONS, col as DuplicationCollection
    );
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

### 6.7 DebitAccountService

```typescript
// src/app/features/debit-accounts/services/debit-account.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { DebitAccount } from '../../../core/models/debit-account.model';

@Injectable({ providedIn: 'root' })
export class DebitAccountService {
  private readonly _accounts$ = new BehaviorSubject<DebitAccount[]>([]);
  readonly accounts$: Observable<DebitAccount[]> = this._accounts$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): DebitAccount[] { return this._accounts$.getValue(); }

  getById(id: string): DebitAccount | undefined {
    return this.getAll().find(a => a.id === id);
  }

  save(account: Partial<DebitAccount>): DebitAccount {
    return this.storage.save<DebitAccount>(STORAGE_KEYS.DEBIT_ACCOUNTS, account as DebitAccount);
  }

  delete(id: string): void {
    this.storage.delete(STORAGE_KEYS.DEBIT_ACCOUNTS, id);
  }

  updateBalance(id: string, decCurrentBalance: number): void {
    const account = this.getById(id);
    if (account) {
      this.save({ ...account, decCurrentBalance });
    }
  }

  private refresh(): void {
    this._accounts$.next(this.storage.getAll<DebitAccount>(STORAGE_KEYS.DEBIT_ACCOUNTS));
  }
}
```

### 6.8 RecurrentTransactionService

```typescript
// src/app/features/recurrent-transactions/services/recurrent-transaction.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { RecurrentTransaction } from '../../../core/models/recurrent-transaction.model';
import { RecurrentTransactionMatch } from '../../../core/models/recurrent-transaction-match.model';

@Injectable({ providedIn: 'root' })
export class RecurrentTransactionService {
  private readonly _recurrents$ = new BehaviorSubject<RecurrentTransaction[]>([]);
  private readonly _matches$ = new BehaviorSubject<RecurrentTransactionMatch[]>([]);

  readonly recurrents$: Observable<RecurrentTransaction[]> = this._recurrents$.asObservable();
  readonly matches$: Observable<RecurrentTransactionMatch[]> = this._matches$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): RecurrentTransaction[] { return this._recurrents$.getValue(); }
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

  delete(id: string): void {
    this.storage.delete(STORAGE_KEYS.RECURRENT_TRANSACTIONS, id);
  }

  private refresh(): void {
    this._recurrents$.next(this.storage.getAll<RecurrentTransaction>(STORAGE_KEYS.RECURRENT_TRANSACTIONS));
    this._matches$.next(this.storage.getAll<RecurrentTransactionMatch>(STORAGE_KEYS.RECURRENT_MATCHES));
  }
}
```

---

## 7. Business Logic Services

These services are **pure and stateless**. They accept plain data as arguments and return results. They have no injected dependencies on `StorageService` or feature services. This isolation makes them trivially testable and backend-migration-safe.

### 7.1 ExcelParserService

Parses an `.xlsx` File object into raw import rows using SheetJS. For debit account imports, the parser reads an additional column `N° Operacion` (or `Operacion` — the exact header is configurable) and maps it to `strOperationNumber`.

```typescript
// src/app/core/services/excel-parser.service.ts
import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface RawImportRow {
  fecha: string;           // YYYY-MM-DD derived from the Fecha column
  descripcion: string;
  moneda: 'PEN' | 'USD';  // 'S/' → PEN, '$' → USD
  monto: number;           // raw amount from Excel (sign preserved as-is from file)
  strOperationNumber?: string;  // debit accounts only
}

@Injectable({ providedIn: 'root' })
export class ExcelParserService {

  async parseFile(file: File): Promise<RawImportRow[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
    return rows
      .filter(r => r['Fecha'] && r['Descripcion'] && r['Moneda'] && r['Monto'] != null)
      .map(r => ({
        fecha: this.parseDate(r['Fecha']),
        descripcion: String(r['Descripcion']).trim(),
        moneda: String(r['Moneda']).trim() === '$' ? 'USD' : 'PEN',
        monto: Number(r['Monto']),
        strOperationNumber: r['N° Operacion'] != null
          ? String(r['N° Operacion']).trim()
          : r['Operacion'] != null
            ? String(r['Operacion']).trim()
            : undefined,
      }));
  }

  private parseDate(value: any): string {
    // SheetJS with cellDates:true returns JS Date objects for date cells
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    // Fallback: treat as string already in YYYY-MM-DD or similar
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
  }
}
```

### 7.2 DuplicationLogicService

Implements the full duplication detection algorithm. Returns an annotated list of incoming rows, each tagged with a flag and optionally the matching existing transaction.

This function is called for both credit card and debit account imports; the `accountType` of the existing transactions determines which rules apply.

```typescript
// src/app/core/services/duplication-logic.service.ts
import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { DuplicationCollection } from '../models/duplication-collection.model';
import { RawImportRow } from './excel-parser.service';

export type DuplicationFlag = 'NONE' | 'AUTO_DUPLICATE' | 'POTENTIAL_DUPLICATE';

export interface AnnotatedImportRow {
  raw: RawImportRow;
  flag: DuplicationFlag;
  matchingTransaction?: Transaction; // set for POTENTIAL_DUPLICATE rows
  /** True by default; set false for AUTO_DUPLICATE rows */
  checked: boolean;
}

@Injectable({ providedIn: 'root' })
export class DuplicationLogicService {

  annotate(
    incoming: RawImportRow[],
    existing: Transaction[],
    collections: DuplicationCollection[]
  ): AnnotatedImportRow[] {
    const active = existing.filter(t => t.strStatus === 'ACTIVE');
    return incoming.map(row => this.annotateRow(row, active, collections));
  }

  private annotateRow(
    row: RawImportRow,
    existing: Transaction[],
    collections: DuplicationCollection[]
  ): AnnotatedImportRow {
    // D1: debit only — same operation number + same date → auto-ignore
    if (row.strOperationNumber && row.moneda !== undefined) {
      const d1 = existing.find(
        t =>
          t.strOperationNumber === row.strOperationNumber &&
          t.dateTransaction === row.fecha &&
          t.accountType === 'DEBIT_ACCOUNT'
      );
      if (d1) {
        return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: d1, checked: false };
      }
    }

    // A1: exact duplicate — same date + description + currency + amount
    const a1 = existing.find(
      t =>
        t.dateTransaction === row.fecha &&
        t.strDescription === row.descripcion &&
        t.strCurrency === row.moneda &&
        t.decAmount === row.monto
    );
    if (a1) {
      return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: a1, checked: false };
    }

    // A2: USD only — same description + same amount, date within ±3 days
    if (row.moneda === 'USD') {
      const a2 = existing.find(
        t =>
          t.strCurrency === 'USD' &&
          t.strDescription === row.descripcion &&
          t.decAmount === row.monto &&
          this.daysDiff(t.dateTransaction, row.fecha) <= 3
      );
      if (a2) {
        return { raw: row, flag: 'AUTO_DUPLICATE', matchingTransaction: a2, checked: false };
      }
    }

    // P1: same amount + first 10 chars of description (case-insensitive) + date ±3 days
    const desc10 = row.descripcion.slice(0, 10).toLowerCase();
    const p1 = existing.find(
      t =>
        t.decAmount === row.monto &&
        t.strDescription.slice(0, 10).toLowerCase() === desc10 &&
        this.daysDiff(t.dateTransaction, row.fecha) <= 3
    );
    if (p1) {
      return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p1, checked: true };
    }

    // P2: same amount + date ±3 days (any description)
    const p2 = existing.find(
      t =>
        t.decAmount === row.monto &&
        this.daysDiff(t.dateTransaction, row.fecha) <= 3
    );
    if (p2) {
      return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p2, checked: true };
    }

    // P3: collection-based
    for (const col of collections) {
      const incomingHit = col.strings.find(s =>
        row.descripcion.toLowerCase().includes(s.toLowerCase())
      );
      if (incomingHit) {
        const p3 = existing.find(t => {
          const existingHit = col.strings.some(s =>
            t.strDescription.toLowerCase().includes(s.toLowerCase())
          );
          return (
            existingHit &&
            t.decAmount === row.monto &&
            t.strCurrency === row.moneda &&
            this.daysDiff(t.dateTransaction, row.fecha) <= 3
          );
        });
        if (p3) {
          return { raw: row, flag: 'POTENTIAL_DUPLICATE', matchingTransaction: p3, checked: true };
        }
      }
    }

    return { raw: row, flag: 'NONE', checked: true };
  }

  private daysDiff(dateA: string, dateB: string): number {
    const msPerDay = 86_400_000;
    return Math.abs(
      new Date(dateA).getTime() - new Date(dateB).getTime()
    ) / msPerDay;
  }
}
```

### 7.3 CategoryMatchingService

Matches a description string against an ordered list of `CategoryRule` objects; returns the first matching `subcategoryId` or `undefined`.

```typescript
// src/app/core/services/category-matching.service.ts
import { Injectable } from '@angular/core';
import { CategoryRule } from '../models/category-rule.model';

@Injectable({ providedIn: 'root' })
export class CategoryMatchingService {

  /** Returns the subcategoryId of the first matching rule (ordered by intPriority ASC),
   *  or undefined if no rule matches. */
  match(description: string, rules: CategoryRule[]): string | undefined {
    const desc = description.toLowerCase();
    const sorted = [...rules].sort((a, b) => a.intPriority - b.intPriority);

    for (const rule of sorted) {
      const pattern = rule.strMatchString.toLowerCase();
      let hit = false;
      switch (rule.strMatchType) {
        case 'STARTS_WITH': hit = desc.startsWith(pattern); break;
        case 'CONTAINS':    hit = desc.includes(pattern);   break;
        case 'ENDS_WITH':   hit = desc.endsWith(pattern);   break;
        case 'EQUALS':      hit = desc === pattern;         break;
      }
      if (hit) return rule.subcategoryId;
    }
    return undefined;
  }
}
```

### 7.4 ConciliationCalculatorService

Pure calculation of cycle boundaries, balances, and interest amount.

```typescript
// src/app/core/services/conciliation-calculator.service.ts
import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';

export interface ConciliationInput {
  cardId: string;
  intClosingDay: number;       // from CreditCard
  todayDate: string;           // YYYY-MM-DD; the date the user initiates reconciliation
  currentBalance: number;      // entered by user as positive; internally negated
  previousClosingBalance: number; // decClosingBalance of most recent CycleClose; 0 if none
  activeTransactions: Transaction[]; // ALL active transactions for this card
}

export interface CycleWindow {
  cycleStart: string;   // YYYY-MM-DD: D+1 of previous month
  closingDate: string;  // YYYY-MM-DD: D of current month
}

export interface ConciliationResult {
  window: CycleWindow;
  openingBalance: number;
  cycleMovementsSum: number;
  amountA: number;              // openingBalance + cycleMovementsSum
  postCloseMovementsSum: number;
  currentBalanceNegated: number; // currentBalance * -1
  amountB: number;              // currentBalanceNegated − postCloseMovementsSum
  interestAmount: number;       // amountB − amountA; 0 if within rounding tolerance
}

@Injectable({ providedIn: 'root' })
export class ConciliationCalculatorService {

  calculate(input: ConciliationInput): ConciliationResult {
    const window = this.buildCycleWindow(input.intClosingDay, input.todayDate);
    const openingBalance = input.previousClosingBalance;

    const cycleMovementsSum = input.activeTransactions
      .filter(
        t => t.accountId === input.cardId &&
             t.dateTransaction >= window.cycleStart &&
             t.dateTransaction <= window.closingDate
      )
      .reduce((sum, t) => sum + t.decAmountPen, 0);

    const amountA = openingBalance + cycleMovementsSum;

    const postCloseMovementsSum = input.activeTransactions
      .filter(
        t => t.accountId === input.cardId &&
             t.dateTransaction > window.closingDate &&
             t.dateTransaction <= input.todayDate
      )
      .reduce((sum, t) => sum + t.decAmountPen, 0);

    const currentBalanceNegated = -Math.abs(input.currentBalance);
    const amountB = currentBalanceNegated - postCloseMovementsSum;
    const rawInterest = amountB - amountA;

    // Treat differences < 0.01 PEN as rounding noise
    const interestAmount = Math.abs(rawInterest) < 0.01 ? 0 : rawInterest;

    return {
      window,
      openingBalance,
      cycleMovementsSum,
      amountA,
      postCloseMovementsSum,
      currentBalanceNegated,
      amountB,
      interestAmount,
    };
  }

  buildCycleWindow(intClosingDay: number, todayDate: string): CycleWindow {
    const today = new Date(todayDate);
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-indexed

    // closingDate: closing day D of the current month
    const closingDate = new Date(currentYear, currentMonth, intClosingDay);
    const closingDateStr = closingDate.toISOString().slice(0, 10);

    // cycleStart: D+1 of the previous month
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const cycleStart = new Date(prevYear, prevMonth, intClosingDay + 1);
    const cycleStartStr = cycleStart.toISOString().slice(0, 10);

    return { cycleStart: cycleStartStr, closingDate: closingDateStr };
  }
}
```

### 7.5 RecurrentMatchingService

Pure service for finding automatic matches between recurrent transaction templates and actual imported transactions.

```typescript
// src/app/core/services/recurrent-matching.service.ts
import { Injectable } from '@angular/core';
import { RecurrentTransaction, RecurrenceFrequency } from '../models/recurrent-transaction.model';
import { RecurrentTransactionMatch } from '../models/recurrent-transaction-match.model';
import { Transaction } from '../models/transaction.model';

export interface RecurrentMatchResult {
  recurrentTransaction: RecurrentTransaction;
  matchedTransaction: Transaction;
  iterationKey: string;
}

@Injectable({ providedIn: 'root' })
export class RecurrentMatchingService {

  /** Compute the iteration key for today's date given the recurrence frequency. */
  getCurrentIterationKey(frequency: RecurrenceFrequency, todayDate: string): string {
    if (frequency === 'MONTHLY') {
      return todayDate.slice(0, 7); // 'YYYY-MM'
    }
    return todayDate.slice(0, 4);   // 'YYYY'
  }

  /** Find automatic matches for all AUTOMATIC recurrents that have no match for the current iteration.
   *  Returns one result per matched recurrent (first transaction match only). */
  findAutomaticMatches(
    recurrents: RecurrentTransaction[],
    existingMatches: RecurrentTransactionMatch[],
    activeTransactions: Transaction[],
    todayDate: string
  ): RecurrentMatchResult[] {
    const results: RecurrentMatchResult[] = [];

    for (const r of recurrents) {
      if (r.strMatchMode !== 'AUTOMATIC') continue;
      const iterationKey = this.getCurrentIterationKey(r.strFrequency, todayDate);

      // Skip if already matched this iteration
      const alreadyMatched = existingMatches.some(
        m => m.recurrentTransactionId === r.id && m.strIterationKey === iterationKey
      );
      if (alreadyMatched) continue;

      const match = this.findMatch(r, activeTransactions, todayDate, iterationKey);
      if (match) {
        results.push({ recurrentTransaction: r, matchedTransaction: match, iterationKey });
      }
    }

    return results;
  }

  private findMatch(
    r: RecurrentTransaction,
    transactions: Transaction[],
    todayDate: string,
    iterationKey: string
  ): Transaction | undefined {
    const approxAmt = r.decApproxAmount ?? 0;
    const range = r.decAmountRange ?? 0;
    const sign = approxAmt < 0 ? -1 : 1;
    const absApprox = Math.abs(approxAmt);
    const minAbs = absApprox - range;
    const maxAbs = absApprox + range;

    const targetDate = this.buildTargetDate(r, iterationKey);

    return transactions.find(t => {
      if (t.accountId !== r.accountId || t.accountType !== r.accountType) return false;
      if (r.strCurrency && t.strCurrency !== r.strCurrency) return false;

      // Amount range check (preserves sign)
      const absActual = Math.abs(t.decAmount);
      const actualSign = t.decAmount < 0 ? -1 : 1;
      if (actualSign !== sign) return false;
      if (absActual < minAbs || absActual > maxAbs) return false;

      // Description check (CONTAINS, case-insensitive)
      if (r.strMatchString &&
          !t.strDescription.toLowerCase().includes(r.strMatchString.toLowerCase())) {
        return false;
      }

      // Date range check
      if (targetDate && r.intDayRange != null) {
        const diff = this.daysDiff(t.dateTransaction, targetDate);
        if (diff > r.intDayRange) return false;
      }

      return true;
    });
  }

  private buildTargetDate(r: RecurrentTransaction, iterationKey: string): string | undefined {
    if (r.intApproxDay == null) return undefined;
    if (r.strFrequency === 'MONTHLY') {
      // iterationKey is 'YYYY-MM'
      const day = String(r.intApproxDay).padStart(2, '0');
      return `${iterationKey}-${day}`;
    }
    // YEARLY: iterationKey is 'YYYY'
    const month = String(r.intApproxMonth ?? 1).padStart(2, '0');
    const day = String(r.intApproxDay).padStart(2, '0');
    return `${iterationKey}-${month}-${day}`;
  }

  private daysDiff(dateA: string, dateB: string): number {
    return Math.abs(
      new Date(dateA).getTime() - new Date(dateB).getTime()
    ) / 86_400_000;
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
│   │   └── app.routes.catalog.ts          ← centralized route path constants
│   │
│   ├── core/
│   │   ├── models/
│   │   │   ├── base.model.ts
│   │   │   ├── credit-card.model.ts
│   │   │   ├── debit-account.model.ts
│   │   │   ├── transaction.model.ts
│   │   │   ├── import-batch.model.ts
│   │   │   ├── category.model.ts
│   │   │   ├── category-rule.model.ts
│   │   │   ├── duplication-collection.model.ts
│   │   │   ├── cycle-snapshot.model.ts
│   │   │   ├── cycle-close.model.ts
│   │   │   ├── recurrent-transaction.model.ts
│   │   │   └── recurrent-transaction-match.model.ts
│   │   │
│   │   ├── services/
│   │   │   ├── storage.service.ts          ← section 5
│   │   │   ├── storage-keys.ts
│   │   │   ├── excel-parser.service.ts     ← section 7.1
│   │   │   ├── duplication-logic.service.ts ← section 7.2
│   │   │   ├── category-matching.service.ts ← section 7.3
│   │   │   ├── conciliation-calculator.service.ts ← section 7.4
│   │   │   └── recurrent-matching.service.ts ← section 7.5
│   │   │
│   │   └── components/
│   │       └── storage-warning-banner/
│   │           ├── storage-warning-banner.component.ts
│   │           └── storage-warning-banner.component.html
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── confirm-dialog/
│   │   │   │   ├── confirm-dialog.component.ts
│   │   │   │   └── confirm-dialog.component.html
│   │   │   └── amount-display/
│   │   │       └── amount-display.component.ts  ← formats PEN/USD amounts
│   │   └── pipes/
│   │       └── currency-pen.pipe.ts
│   │
│   ├── layout/
│   │   ├── shell/
│   │   │   ├── shell.component.ts
│   │   │   └── shell.component.html       ← sidenav + router-outlet
│   │   └── sidenav/
│   │       └── sidenav.component.ts
│   │
│   └── features/
│       │
│       ├── credit-cards/                  ← lazy-loaded
│       │   ├── credit-cards.routes.ts
│       │   ├── services/
│       │   │   └── credit-card.service.ts
│       │   └── pages/
│       │       ├── card-list/
│       │       │   ├── card-list.component.ts
│       │       │   └── card-list.component.html
│       │       └── card-form/
│       │           ├── card-form.component.ts
│       │           └── card-form.component.html
│       │
│       ├── transactions/                  ← lazy-loaded
│       │   ├── transactions.routes.ts
│       │   ├── services/
│       │   │   └── transaction.service.ts
│       │   └── pages/
│       │       ├── transaction-list/
│       │       │   ├── transaction-list.component.ts
│       │       │   └── transaction-list.component.html
│       │       └── transaction-detail/
│       │           ├── transaction-detail.component.ts
│       │           └── transaction-detail.component.html
│       │
│       ├── import/                        ← lazy-loaded
│       │   ├── import.routes.ts
│       │   ├── services/
│       │   │   └── import-batch.service.ts
│       │   ├── state/
│       │   │   └── import-wizard.state.ts  ← BehaviorSubject holding wizard state
│       │   └── pages/
│       │       ├── import-wizard/
│       │       │   ├── import-wizard.component.ts   ← step container
│       │       │   └── import-wizard.component.html
│       │       ├── step-upload/
│       │       │   ├── step-upload.component.ts
│       │       │   └── step-upload.component.html
│       │       └── step-review/
│       │           ├── step-review.component.ts
│       │           └── step-review.component.html
│       │
│       ├── categories/                    ← lazy-loaded
│       │   ├── categories.routes.ts
│       │   ├── services/
│       │   │   ├── category.service.ts
│       │   │   └── duplication-collection.service.ts
│       │   └── pages/
│       │       ├── category-list/
│       │       │   ├── category-list.component.ts
│       │       │   └── category-list.component.html
│       │       ├── category-rule-list/
│       │       │   ├── category-rule-list.component.ts
│       │       │   └── category-rule-list.component.html
│       │       └── duplication-collection-list/
│       │           ├── duplication-collection-list.component.ts
│       │           └── duplication-collection-list.component.html
│       │
│       ├── conciliation/                  ← lazy-loaded
│       │   ├── conciliation.routes.ts
│       │   ├── services/
│       │   │   └── conciliation.service.ts
│       │   └── pages/
│       │       ├── conciliation-form/
│       │       │   ├── conciliation-form.component.ts
│       │       │   └── conciliation-form.component.html
│       │       └── conciliation-history/
│       │           ├── conciliation-history.component.ts
│       │           └── conciliation-history.component.html
│       │
│       ├── debit-accounts/                ← lazy-loaded
│       │   ├── debit-accounts.routes.ts
│       │   ├── services/
│       │   │   └── debit-account.service.ts
│       │   └── pages/
│       │       ├── debit-account-list/
│       │       │   ├── debit-account-list.component.ts
│       │       │   └── debit-account-list.component.html
│       │       └── debit-account-form/
│       │           ├── debit-account-form.component.ts
│       │           └── debit-account-form.component.html
│       │
│       └── recurrent-transactions/        ← lazy-loaded
│           ├── recurrent-transactions.routes.ts
│           ├── services/
│           │   └── recurrent-transaction.service.ts
│           └── pages/
│               ├── recurrent-list/
│               │   ├── recurrent-list.component.ts
│               │   └── recurrent-list.component.html
│               ├── recurrent-form/
│               │   ├── recurrent-form.component.ts
│               │   └── recurrent-form.component.html
│               └── recurrent-dashboard/
│                   ├── recurrent-dashboard.component.ts
│                   └── recurrent-dashboard.component.html
```

### Route catalog

```typescript
// src/app/application/app.routes.catalog.ts
export const ROUTES = {
  CREDIT_CARDS:              'credit-cards',
  TRANSACTIONS:              'transactions',
  IMPORT:                    'import',
  CATEGORIES:                'categories',
  CATEGORY_RULES:            'categories/rules',
  DUPLICATION_COLLECTIONS:   'categories/duplications',
  CONCILIATION:              'conciliation',
  DEBIT_ACCOUNTS:            'debit-accounts',
  RECURRENT_TRANSACTIONS:    'recurrent-transactions',
  RECURRENT_DASHBOARD:       'recurrent-transactions/dashboard',
} as const;
```

### Lazy route registration example

```typescript
// src/app/application/app.routes.ts
import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      {
        path: 'credit-cards',
        loadChildren: () =>
          import('../features/credit-cards/credit-cards.routes').then(m => m.CREDIT_CARD_ROUTES),
      },
      {
        path: 'import',
        loadChildren: () =>
          import('../features/import/import.routes').then(m => m.IMPORT_ROUTES),
      },
      {
        path: 'categories',
        loadChildren: () =>
          import('../features/categories/categories.routes').then(m => m.CATEGORY_ROUTES),
      },
      {
        path: 'conciliation',
        loadChildren: () =>
          import('../features/conciliation/conciliation.routes').then(m => m.CONCILIATION_ROUTES),
      },
      { path: '', redirectTo: 'credit-cards', pathMatch: 'full' },
    ],
  },
];
```

---

## 9. Import Wizard — Data Flow

The import wizard consists of two steps: **Upload** and **Review**. An intermediate state object lives in `ImportWizardState` (a `BehaviorSubject` in `import-wizard.state.ts`) and is shared between the two step components via a service.

```typescript
// src/app/features/import/state/import-wizard.state.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AnnotatedImportRow } from '../../../core/services/duplication-logic.service';
import { AccountType } from '../../../core/models/transaction.model';

export interface ImportWizardState {
  accountId: string | null;
  accountType: AccountType | null;
  file: File | null;
  currentBalance: number | null;   // entered as positive; negated on save
  usdExchangeRate: number | null;
  annotatedRows: AnnotatedImportRow[];
  contextDates: string[];          // 5 days before earliest incoming date
}

const INITIAL: ImportWizardState = {
  accountId: null,
  accountType: null,
  file: null,
  currentBalance: null,
  usdExchangeRate: null,
  annotatedRows: [],
  contextDates: [],
};

@Injectable({ providedIn: 'root' })
export class ImportWizardStateService {
  private readonly _state$ = new BehaviorSubject<ImportWizardState>({ ...INITIAL });
  readonly state$ = this._state$.asObservable();

  patch(partial: Partial<ImportWizardState>): void {
    this._state$.next({ ...this._state$.getValue(), ...partial });
  }

  reset(): void {
    this._state$.next({ ...INITIAL });
  }

  snapshot(): ImportWizardState {
    return this._state$.getValue();
  }
}
```

### Step-by-step data flow

**Step 1 — Upload (`StepUploadComponent`)**

1. User selects an account from a `<mat-select>` bound to both `CreditCardService.cards$` and `DebitAccountService.accounts$` — accounts are grouped or shown with a type indicator (credit card vs. debit/savings).
2. User picks an `.xlsx` file via `<input type="file">`.
3. User enters current balance (positive number) and USD/PEN exchange rate.
4. For debit account imports, the Excel is expected to have an extra column `N° Operacion` (or similar); parsed as `strOperationNumber`.
5. On "Next":
   - `ExcelParserService.parseFile(file)` is called → returns `RawImportRow[]`.
   - Convert raw rows to partial `Transaction` shapes:
     - `strCurrency`: `'S/'` → `'PEN'`; `'$'` → `'USD'`
     - `decAmount`: use `monto` directly (sign from file)
     - `decAmountPen`: if PEN → `monto`; if USD → `monto × usdExchangeRate`
   - Call `DuplicationLogicService.annotate(rawRows, existingTransactions, collections)` → `AnnotatedImportRow[]`.
   - Run `CategoryMatchingService.match(description, rules)` for each row to pre-populate `subcategoryId`.
   - Compute `contextDates`: find the earliest `dateTransaction` in incoming rows, then collect all active transactions for the selected account from 5 days before that date.
   - Push all of the above into `ImportWizardStateService.patch(...)`.
   - Navigate to Step 2.

**Step 2 — Review (`StepReviewComponent`)**

1. Component reads state from `ImportWizardStateService.state$`.
2. Rows are grouped by `dateTransaction` descending and rendered in a list.
3. Each row shows:
   - Checkbox (bound to `annotatedRow.checked`; AUTO_DUPLICATE rows are unchecked and disabled).
   - Grayed styling for `AUTO_DUPLICATE`.
   - Yellow/orange highlight for `POTENTIAL_DUPLICATE`.
   - Below each POTENTIAL_DUPLICATE row: the matching existing transaction rendered as a read-only sub-row.
   - `<mat-select>` for subcategory (pre-populated from category matching; user may change).
   - A context menu ("...") with options:
     - "Add additional info" → opens `MatDialog` with a free-text textarea; the note is stored back on the annotated row.
     - "Mark as Pending" → sets the `annotatedRow`'s `pendingFlag` to `true`; those rows will be saved with `strStatus: 'PENDING'` instead of `'ACTIVE'`.
4. Existing transactions from the context date range are rendered below the incoming rows as read-only rows with a trash icon. Clicking trash calls `TransactionService.softDelete(id)`.
5. On "Confirm":
   - Create one `ImportBatch` via `ImportBatchService.save(...)`:
     ```typescript
     const batch = importBatchService.save({
       accountId,
       accountType,
       dateImport: today,
       decUsdExchangeRate: usdExchangeRate,
       decBalanceAtImport: accountType === 'CREDIT_CARD'
         ? -Math.abs(currentBalance)
         : currentBalance,
     });
     ```
   - Filter `annotatedRows` to those with `checked === true`.
   - Map each to a `Partial<Transaction>`:
     ```typescript
     {
       accountId,
       accountType,
       importBatchId: batch.id,
       dateTransaction: row.raw.fecha,
       strDescription: row.raw.descripcion,
       strCurrency: row.raw.moneda,
       decAmount: row.raw.monto,
       decAmountPen: row.raw.moneda === 'PEN'
         ? row.raw.monto
         : row.raw.monto * usdExchangeRate,
       subcategoryId: row.subcategoryId,
       strNotes: row.note ?? undefined,
       strOperationNumber: row.raw.strOperationNumber,
       strStatus: row.pendingFlag ? 'PENDING' : 'ACTIVE',
     }
     ```
   - Call `TransactionService.saveMany(transactions)` — writes all in a single `localStorage.setItem` call.
   - Update the account's `decCurrentBalance`:
     - If `accountType === 'CREDIT_CARD'`: call `CreditCardService.save({ ...card, decCurrentBalance: -Math.abs(currentBalance) })`.
     - If `accountType === 'DEBIT_ACCOUNT'`: call `DebitAccountService.updateBalance(accountId, currentBalance)`.
   - Call `ImportWizardStateService.reset()`.
   - Navigate to the transaction list for the selected account.
   - Check storage size via `StorageService.getTotalBytes()`; show warning banner if > 4 MB.

**What is written to localStorage on confirm:**

| Key | Action |
|---|---|
| `pfmg_import_batches` | One new `ImportBatch` appended |
| `pfmg_transactions` | N new `Transaction` records appended (one per checked row) |
| `pfmg_credit_cards` or `pfmg_debit_accounts` | Account's `decCurrentBalance` updated |

---

## 10. Conciliation UI Flow

### Inputs collected from the user (`ConciliationFormComponent`)

1. Select credit card → loads `CreditCard` with `intClosingDay`.
2. Enter current balance (positive number, e.g., "1500.00 PEN").
3. The form auto-displays the computed cycle window:
   - Calls `ConciliationCalculatorService.buildCycleWindow(intClosingDay, todayDate)`.
   - Shows "Cycle: {cycleStart} → {closingDate}".
4. Click "Calculate" → calls `ConciliationCalculatorService.calculate(input)`.

### Preview display

The result object is rendered as a summary table:

| Label | Value |
|---|---|
| Opening balance | `result.openingBalance` |
| Cycle movements | `result.cycleMovementsSum` |
| Amount A (expected closing) | `result.amountA` |
| Current balance (negated) | `result.currentBalanceNegated` |
| Post-close movements | `result.postCloseMovementsSum` |
| Amount B (verified closing) | `result.amountB` |
| **Interest detected** | `result.interestAmount` (highlighted red if ≠ 0) |

If `interestAmount === 0` the "interest transaction" row in the preview is hidden.  
If `interestAmount !== 0` the preview shows an additional row: a synthetic interest transaction that will be created on `closingDate` with `strDescription = 'INTERES'`.

### On confirm

1. If `interestAmount !== 0`:
   - Call `TransactionService.save(...)` with:
     ```typescript
     {
       accountId: cardId,
       accountType: 'CREDIT_CARD',
       dateTransaction: result.window.closingDate,
       strDescription: 'INTERES',
       strCurrency: 'PEN',
       decAmount: result.interestAmount,
       decAmountPen: result.interestAmount,
       strStatus: 'ACTIVE',
     }
     ```
   - Capture returned transaction id as `interestTransactionId`.

2. Call `ConciliationService.saveCycleClose(...)`:
   ```typescript
   {
     cardId,
     dateClosing: result.window.closingDate,
     decOpeningBalance: result.openingBalance,
     decClosingBalance: result.amountB,
     decInterestAmount: result.interestAmount,
     interestTransactionId: interestTransactionId ?? undefined,
   }
   ```

3. Call `ConciliationService.saveCycleSnapshot(...)`:
   ```typescript
   {
     cardId,
     dateSnapshot: result.window.closingDate,
     decBalanceAtSnapshot: result.amountB,
     strType: 'CYCLE_CLOSE',
   }
   ```

4. Check storage size; show warning banner if > 4 MB.
5. Navigate to conciliation history for the card.

**What is written to localStorage on confirm:**

| Key | Action |
|---|---|
| `pfmg_transactions` | 0 or 1 new interest `Transaction` appended |
| `pfmg_cycle_closes` | One new `CycleClose` appended |
| `pfmg_cycle_snapshots` | One new `CycleSnapshot` appended |

---

## 11. localStorage Size Considerations

Browsers enforce a per-origin `localStorage` quota of approximately **5–10 MB** (typically 5 MB in Chrome and Firefox). JSON serialization overhead is roughly 2× raw data size in UTF-16 encoding.

### Capacity estimate

A single transaction serialized is approximately 400–600 bytes of JSON. At 5 MB usable:

- ~8,000–12,000 transactions before hitting the limit.
- For typical monthly credit card usage (50–100 transactions/month), this covers **6–10 years** of data before a warning is needed.

### Warning implementation

`StorageService.getTotalBytes()` returns an approximate byte count. Call it after every import or conciliation confirm:

```typescript
const WARN_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4 MB

if (this.storageService.getTotalBytes() > WARN_THRESHOLD_BYTES) {
  // Emit a signal to the StorageWarningBannerComponent
  this.storageWarningService.show();
}
```

`StorageWarningBannerComponent` subscribes to the warning signal and renders a `mat-snack-bar` or a dismissible banner at the top of the page. No data archiving or pagination is needed at this stage — the warning is purely informational.

---

## 12. Migration Path to Backend

When the UI is stable and ready to connect to the real backend (described in `DESIGN.md`), migration requires changes only in the **feature services**. The business logic services and all components remain identical.

### What changes: feature services only

Each feature service currently calls `StorageService`. In the migrated version, those calls are replaced by `HttpClient` calls to the corresponding API endpoints.

**Before (localStorage):**

```typescript
save(card: Partial<CreditCard>): CreditCard {
  return this.storage.save<CreditCard>(STORAGE_KEYS.CREDIT_CARDS, card as CreditCard);
}
```

**After (HTTP backend):**

```typescript
save(card: Partial<CreditCard>): Observable<CreditCard> {
  return card.id
    ? this.http.put<CreditCard>(`/api/credit-cards/${card.id}`, card)
    : this.http.post<CreditCard>('/api/credit-cards', card);
}
```

The `BehaviorSubject` stream refresh mechanism also changes: instead of reacting to `StorageService.changes$`, each service calls its own GET endpoint to refresh after a mutation.

### What does NOT change

| Layer | Change needed |
|---|---|
| `ExcelParserService` | None — parsing is always browser-side |
| `DuplicationLogicService` | None — pure TypeScript |
| `CategoryMatchingService` | None — pure TypeScript |
| `ConciliationCalculatorService` | None — pure TypeScript |
| `RecurrentMatchingService` | None — pure TypeScript |
| All feature components | None — they bind to `Observable` streams |
| All templates | None |
| `ImportWizardStateService` | None |
| TypeScript interfaces/models | None |

### Migration checklist

1. Add `HttpClientModule` (or `provideHttpClient()`) to the app configuration.
2. For each feature service: replace `StorageService` injection with `HttpClient` injection.
3. Swap synchronous `getAll()` returns with `Observable<T[]>` from HTTP GET.
4. Update the `BehaviorSubject` refresh trigger from `storage.changes$` to post-mutation HTTP reload.
5. Migrate `RecurrentTransactionService` and `DebitAccountService` to HTTP calls following the same pattern as the credit card services.
6. Remove `StorageService` and `STORAGE_KEYS` once all services are migrated.
7. Remove the `StorageWarningBannerComponent` (no longer needed).

The entire migration can be done incrementally: one feature service at a time, with the rest still reading from localStorage.
