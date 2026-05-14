# Credit Card Transaction Tracking System — Local-Only Design Document

**Version:** 1.0  
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
7. [Business Logic Services](#7-business-logic-services)
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
  intClosingDay: number; // 1–31
}
```

```typescript
// src/app/core/models/import-batch.model.ts
import { BaseEntity } from './base.model';

export interface ImportBatch extends BaseEntity {
  cardId: string;
  dateImport: string;          // YYYY-MM-DD
  decUsdExchangeRate: number;  // PEN per 1 USD at import time
  decBalanceAtImport: number;  // negative = owed
}
```

```typescript
// src/app/core/models/transaction.model.ts
import { BaseEntity } from './base.model';

export type TransactionCurrency = 'PEN' | 'USD';
export type TransactionStatus = 'ACTIVE' | 'DELETED';

export interface Transaction extends BaseEntity {
  cardId: string;
  importBatchId?: string;       // nullable; null for manually created transactions
  dateTransaction: string;      // YYYY-MM-DD
  strDescription: string;
  strCurrency: TransactionCurrency;
  decAmount: number;            // negative = charge, positive = payment
  decAmountPen: number;         // always in PEN; USD rows = decAmount × exchange rate
  subcategoryId?: string;       // nullable
  strNotes?: string;            // nullable
  strStatus: TransactionStatus;
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
| `pfmg_transactions` | `Transaction[]` | All transactions (including DELETED) |
| `pfmg_import_batches` | `ImportBatch[]` | One record per Excel import event |
| `pfmg_categories` | `Category[]` | Top-level categories |
| `pfmg_subcategories` | `Subcategory[]` | Subcategories linked to a category |
| `pfmg_category_rules` | `CategoryRule[]` | Matching rules for auto-categorization |
| `pfmg_duplication_collections` | `DuplicationCollection[]` | Named string sets for P3 duplication detection |
| `pfmg_cycle_snapshots` | `CycleSnapshot[]` | Mid-cycle and cycle-close balance snapshots |
| `pfmg_cycle_closes` | `CycleClose[]` | Finalized cycle reconciliation records |

### Serialized shape example

```json
// localStorage key: pfmg_transactions
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "cardId": "card-uuid-1",
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
    "dateCreation": "2026-04-01T10:00:00.000Z",
    "dateModification": "2026-04-01T10:00:00.000Z"
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
  TRANSACTIONS:             'pfmg_transactions',
  IMPORT_BATCHES:           'pfmg_import_batches',
  CATEGORIES:               'pfmg_categories',
  SUBCATEGORIES:            'pfmg_subcategories',
  CATEGORY_RULES:           'pfmg_category_rules',
  DUPLICATION_COLLECTIONS:  'pfmg_duplication_collections',
  CYCLE_SNAPSHOTS:          'pfmg_cycle_snapshots',
  CYCLE_CLOSES:             'pfmg_cycle_closes',
} as const;
```

---

## 6. Feature Services

Each feature service injects `StorageService`, owns a `BehaviorSubject` for its collection, and re-emits on every write. Components bind to `service.items$` for reactive updates. Business rules are delegated to the logic services described in section 7.

### 6.1 CreditCardService

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
    return this.getAll().filter(t => t.cardId === cardId);
  }

  getActiveByCardAndDateRange(cardId: string, from: string, to: string): Transaction[] {
    return this.getActive().filter(
      t => t.cardId === cardId && t.dateTransaction >= from && t.dateTransaction <= to
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

---

## 7. Business Logic Services

These services are **pure and stateless**. They accept plain data as arguments and return results. They have no injected dependencies on `StorageService` or feature services. This isolation makes them trivially testable and backend-migration-safe.

### 7.1 ExcelParserService

Parses an `.xlsx` File object into raw import rows using SheetJS.

```typescript
// src/app/core/services/excel-parser.service.ts
import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface RawImportRow {
  fecha: string;           // YYYY-MM-DD derived from the Fecha column
  descripcion: string;
  moneda: 'PEN' | 'USD';  // 'S/' → PEN, '$' → USD
  monto: number;           // raw amount from Excel (sign preserved as-is from file)
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

Implements the full five-rule duplication detection algorithm. Returns an annotated list of incoming rows, each tagged with a flag and optionally the matching existing transaction.

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
        t => t.cardId === input.cardId &&
             t.dateTransaction >= window.cycleStart &&
             t.dateTransaction <= window.closingDate
      )
      .reduce((sum, t) => sum + t.decAmountPen, 0);

    const amountA = openingBalance + cycleMovementsSum;

    const postCloseMovementsSum = input.activeTransactions
      .filter(
        t => t.cardId === input.cardId &&
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
│   │   │   ├── transaction.model.ts
│   │   │   ├── import-batch.model.ts
│   │   │   ├── category.model.ts
│   │   │   ├── category-rule.model.ts
│   │   │   ├── duplication-collection.model.ts
│   │   │   ├── cycle-snapshot.model.ts
│   │   │   └── cycle-close.model.ts
│   │   │
│   │   ├── services/
│   │   │   ├── storage.service.ts          ← section 5
│   │   │   ├── storage-keys.ts
│   │   │   ├── excel-parser.service.ts     ← section 7.1
│   │   │   ├── duplication-logic.service.ts ← section 7.2
│   │   │   ├── category-matching.service.ts ← section 7.3
│   │   │   └── conciliation-calculator.service.ts ← section 7.4
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
│       └── conciliation/                  ← lazy-loaded
│           ├── conciliation.routes.ts
│           ├── services/
│           │   └── conciliation.service.ts
│           └── pages/
│               ├── conciliation-form/
│               │   ├── conciliation-form.component.ts
│               │   └── conciliation-form.component.html
│               └── conciliation-history/
│                   ├── conciliation-history.component.ts
│                   └── conciliation-history.component.html
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

export interface ImportWizardState {
  cardId: string | null;
  file: File | null;
  currentBalance: number | null;   // entered as positive; negated on save
  usdExchangeRate: number | null;
  annotatedRows: AnnotatedImportRow[];
  contextDates: string[];          // 5 days before earliest incoming date
}

const INITIAL: ImportWizardState = {
  cardId: null,
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

1. User selects a credit card from a `<mat-select>` bound to `CreditCardService.cards$`.
2. User picks an `.xlsx` file via `<input type="file">`.
3. User enters current balance (positive number) and USD/PEN exchange rate.
4. On "Next":
   - `ExcelParserService.parseFile(file)` is called → returns `RawImportRow[]`.
   - Convert raw rows to partial `Transaction` shapes:
     - `strCurrency`: `'S/'` → `'PEN'`; `'$'` → `'USD'`
     - `decAmount`: use `monto` directly (sign from file)
     - `decAmountPen`: if PEN → `monto`; if USD → `monto × usdExchangeRate`
   - Call `DuplicationLogicService.annotate(rawRows, existingTransactions, collections)` → `AnnotatedImportRow[]`.
   - Run `CategoryMatchingService.match(description, rules)` for each row to pre-populate `subcategoryId`.
   - Compute `contextDates`: find the earliest `dateTransaction` in incoming rows, then collect all active transactions for the selected card from 5 days before that date.
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
   - A context menu ("...") with option "Add additional info" → opens `MatDialog` with a free-text textarea; the note is stored back on the annotated row.
4. Existing transactions from the context date range are rendered below the incoming rows as read-only rows with a trash icon. Clicking trash calls `TransactionService.softDelete(id)`.
5. On "Confirm":
   - Create one `ImportBatch` via `ImportBatchService.save(...)`:
     ```typescript
     const batch = importBatchService.save({
       cardId,
       dateImport: today,
       decUsdExchangeRate: usdExchangeRate,
       decBalanceAtImport: -Math.abs(currentBalance),
     });
     ```
   - Filter `annotatedRows` to those with `checked === true`.
   - Map each to a `Partial<Transaction>`:
     ```typescript
     {
       cardId,
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
       strStatus: 'ACTIVE',
     }
     ```
   - Call `TransactionService.saveMany(transactions)` — writes all in a single `localStorage.setItem` call.
   - Call `ImportWizardStateService.reset()`.
   - Navigate to the transaction list for the selected card.
   - Check storage size via `StorageService.getTotalBytes()`; show warning banner if > 4 MB.

**What is written to localStorage on confirm:**

| Key | Action |
|---|---|
| `pfmg_import_batches` | One new `ImportBatch` appended |
| `pfmg_transactions` | N new `Transaction` records appended (one per checked row) |

No other keys are modified during import.

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
       cardId,
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
| All feature components | None — they bind to `Observable` streams |
| All templates | None |
| `ImportWizardStateService` | None |
| TypeScript interfaces/models | None |

### Migration checklist

1. Add `HttpClientModule` (or `provideHttpClient()`) to the app configuration.
2. For each feature service: replace `StorageService` injection with `HttpClient` injection.
3. Swap synchronous `getAll()` returns with `Observable<T[]>` from HTTP GET.
4. Update the `BehaviorSubject` refresh trigger from `storage.changes$` to post-mutation HTTP reload.
5. Remove `StorageService` and `STORAGE_KEYS` once all services are migrated.
6. Remove the `StorageWarningBannerComponent` (no longer needed).

The entire migration can be done incrementally: one feature service at a time, with the rest still reading from localStorage.
