# WP01 — Foundation: Models, Storage, Settings

**Depends on:** nothing (first package to run)  
**Spec:** DESIGN_LOCAL_v5.md §3, §4, §5, §6.9

---

## Goal

Lay the data layer: install SheetJS, create all TypeScript interfaces, `StorageService`, `storage-keys.ts`, and `SettingsService`. No UI. No feature services.

---

## Step 1 — Install SheetJS

```
npm install xlsx
```

Verify it appears in `package.json` dependencies.

---

## Step 2 — Create `src/app/core/` directory tree

Create the following empty directories (create a `.gitkeep` if needed):
```
src/app/core/models/
src/app/core/services/
src/app/core/components/storage-warning-banner/
```

---

## Step 3 — TypeScript Models

Create each file exactly as specified. All files in `src/app/core/models/`.

### `base.model.ts`
```typescript
export interface BaseEntity {
  id: string;
  dateCreation: string;
  dateModification: string;
}
```

### `credit-card.model.ts`
```typescript
import { BaseEntity } from './base.model';

export interface CreditCard extends BaseEntity {
  strName: string;
  intClosingDay: number;
  intPaymentDay: number;
}
```

### `debit-account.model.ts`
```typescript
import { BaseEntity } from './base.model';

export interface DebitAccount extends BaseEntity {
  strName: string;
}
```

### `transaction.model.ts`
```typescript
import { BaseEntity } from './base.model';

export type TransactionCurrency = 'PEN' | 'USD';
export type TransactionStatus   = 'ACTIVE' | 'DELETED' | 'PENDING';
export type AccountType         = 'CREDIT_CARD' | 'DEBIT_ACCOUNT';

export interface Transaction extends BaseEntity {
  accountId: string;
  accountType: AccountType;
  importBatchId?: string;
  dateTransaction: string;
  strDescription: string;
  strCurrency: TransactionCurrency;
  decAmount: number;
  decAmountPen: number;
  subcategoryId?: string;
  strNotes?: string;
  strStatus: TransactionStatus;
  strOperationNumber?: string;
  transferGroupId?: string;
}
```

### `import-batch.model.ts`
```typescript
import { BaseEntity } from './base.model';
import { AccountType, TransactionCurrency } from './transaction.model';

export interface ImportBatch extends BaseEntity {
  accountId: string;
  accountType: AccountType;
  dateImport: string;
  decUsdExchangeRate: number;
  decBalanceAtImport: number;
}

export interface RawImportRow {
  dateTransaction: string;
  description: string;
  currency: TransactionCurrency;
  amount: number;
  amountPen: number;
  strOperationNumber?: string;
}

export interface ParseFileResult {
  rows: RawImportRow[];
  hasMultipleSheets: boolean;
  hasUsdRows: boolean;
}
```

### `category.model.ts`
```typescript
import { BaseEntity } from './base.model';

export interface Category extends BaseEntity {
  strName: string;
}

export interface Subcategory extends BaseEntity {
  categoryId: string;
  strName: string;
}
```

### `category-rule.model.ts`
```typescript
import { BaseEntity } from './base.model';

export type MatchType = 'STARTS_WITH' | 'CONTAINS' | 'ENDS_WITH' | 'EQUALS';

export interface CategoryRule extends BaseEntity {
  subcategoryId: string;
  strMatchString: string;
  strMatchType: MatchType;
  intPriority: number;
}
```

### `duplication-collection.model.ts`
```typescript
import { BaseEntity } from './base.model';

export interface DuplicationCollection extends BaseEntity {
  strName: string;
  strings: string[];
}
```

### `cycle-snapshot.model.ts`
```typescript
import { BaseEntity } from './base.model';

export type SnapshotType = 'SNAPSHOT' | 'CYCLE_CLOSE';

export interface CycleSnapshot extends BaseEntity {
  cardId: string;
  dateSnapshot: string;
  decBalanceAtSnapshot: number;
  strType: SnapshotType;
}
```

### `cycle-close.model.ts`
```typescript
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

### `recurrent-transaction.model.ts`
```typescript
import { BaseEntity } from './base.model';
import { AccountType, TransactionCurrency } from './transaction.model';

export type RecurrenceFrequency = 'MONTHLY' | 'YEARLY';
export type RecurrenceMatchMode = 'MANUAL' | 'AUTOMATIC';
export type RecurrentStatus     = 'DONE' | 'PENDING' | 'NOT_YET_DUE' | 'NOT_CONFIGURED';

export interface RecurrentTransaction extends BaseEntity {
  strName: string;
  strNotes?: string;
  accountId: string;
  accountType: AccountType;
  strFrequency: RecurrenceFrequency;
  strMatchMode: RecurrenceMatchMode;
  strCurrency?: TransactionCurrency;
  decApproxAmount?: number;
  decAmountRange?: number;
  strMatchString?: string;
  intApproxDay?: number;
  intApproxMonth?: number;
  intDayRange?: number;
}
```

### `recurrent-transaction-match.model.ts`
```typescript
import { BaseEntity } from './base.model';
import { RecurrenceMatchMode } from './recurrent-transaction.model';

export interface RecurrentTransactionMatch extends BaseEntity {
  recurrentTransactionId: string;
  strIterationKey: string;
  transactionId?: string;
  boolDone: boolean;
  dateDone?: string;
  strMatchMode: RecurrenceMatchMode;
}
```

### `app-settings.model.ts`
```typescript
export interface AppSettings {
  boolP2RuleEnabled: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  boolP2RuleEnabled: false,
};
```

---

## Step 4 — `storage-keys.ts`

File: `src/app/core/services/storage-keys.ts`

```typescript
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

## Step 5 — `StorageService`

File: `src/app/core/services/storage.service.ts`

Copy verbatim from DESIGN_LOCAL_v5.md §5. Key behaviors:
- `getAll<T>()` skips records where `id` is missing (corrupted entries guard).
- `save<T>()` handles both CREATE (no id) and UPDATE (id exists) with `dateCreation` fallback on UPDATE path.
- `persist()` is private, wrapped in try-catch, throws `StorageWriteError`.
- `changes$: BehaviorSubject<void>` emits after every successful write.
- `getTotalBytes()` iterates `localStorage` and multiplies by 2 (UTF-16).

```typescript
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
          dateCreation: (all[idx] as any).dateCreation ?? now,
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

---

## Step 6 — `SettingsService`

File: `src/app/core/services/settings.service.ts`

Copy verbatim from DESIGN_LOCAL_v5.md §6.9. Note: this service accesses `localStorage` directly (not via `StorageService`) because `pfmg_settings` is a single JSON object, not an array.

---

## Step 7 — `StorageWarningBannerComponent`

Files:
- `src/app/core/components/storage-warning-banner/storage-warning-banner.component.ts`
- `src/app/core/components/storage-warning-banner/storage-warning-banner.component.html`

This is a simple dismissable amber banner shown when localStorage usage exceeds 4 MB.

```typescript
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-storage-warning-banner',
  standalone: false,
  templateUrl: './storage-warning-banner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorageWarningBannerComponent {
  @Input() visible = false;
  dismissed = false;
}
```

Template: amber Tailwind banner with a dismiss (×) button. Only renders when `visible && !dismissed`.

---

## Step 8 — Create `CoreModule`

File: `src/app/core/core.module.ts`

Declare and export `StorageWarningBannerComponent`. Provide nothing (services are `providedIn: 'root'`).

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageWarningBannerComponent } from './components/storage-warning-banner/storage-warning-banner.component';

@NgModule({
  declarations: [StorageWarningBannerComponent],
  imports: [CommonModule],
  exports: [StorageWarningBannerComponent],
})
export class CoreModule {}
```

Import `CoreModule` in `AppModule`.

---

## Acceptance Criteria

- `npm run build` passes with no TypeScript errors.
- All 13 model files exist in `src/app/core/models/`.
- `StorageService`, `storage-keys.ts`, `SettingsService` exist in `src/app/core/services/`.
- `StorageWarningBannerComponent` exists and is exported from `CoreModule`.
- `CoreModule` is imported in `AppModule`.
- `xlsx` appears in `package.json` dependencies and `node_modules/xlsx/` exists.
