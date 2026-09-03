# WP04 — Feature Services: Accounts & Import Batches

**Depends on:** WP01  
**Spec:** DESIGN_LOCAL_v5.md §6.1, §6.3, §6.7

---

## Goal

Implement the three account-related feature services: `CreditCardService`, `DebitAccountService`, and `ImportBatchService`. These are `providedIn: 'root'` services that wrap `StorageService` with domain-specific methods and expose reactive `Observable` streams.

---

## Common Service Pattern

All three services follow this pattern:
1. A private `BehaviorSubject<T[]>` holds the current in-memory state.
2. On construction: call `this.refresh()` once, then subscribe to `storage.changes$` to refresh on any storage write.
3. `getAll()` returns the current snapshot synchronously.
4. Mutations call `this.storage.save()` or `this.storage.delete()` — the `changes$` subscription handles re-loading automatically.

---

## Step 1 — `CreditCardService`

File: `src/app/features/credit-cards/services/credit-card.service.ts`

Copy from DESIGN_LOCAL_v5.md §6.1. Key points:

- `cards$: Observable<CreditCard[]>` for template binding.
- `getAll(): CreditCard[]` — synchronous snapshot.
- `getById(id: string): CreditCard | undefined`.
- `save(card: Partial<CreditCard>): CreditCard` — create or update.
- `deleteWithCascade(id, deps)` — cascades through transactions, import batches, cycle closes/snapshots, and recurrent transactions before deleting the card itself. The `deps` parameter carries the other services as an object to avoid circular injection at constructor time.

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CreditCard } from '../../../core/models/credit-card.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
// Import other service types for deleteWithCascade deps parameter (type-only, no circular injection)
import { TransactionService } from '../../transactions/services/transaction.service';
import { ImportBatchService } from '../../import/services/import-batch.service';
import { ConciliationService } from '../../conciliation/services/conciliation.service';
import { RecurrentTransactionService } from '../../recurrent-transactions/services/recurrent-transaction.service';

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

  deleteWithCascade(
    id: string,
    deps: {
      transactionService: TransactionService;
      importBatchService: ImportBatchService;
      conciliationService: ConciliationService;
      recurrentService: RecurrentTransactionService;
    }
  ): void {
    deps.transactionService.getAll()
      .filter(t => t.accountId === id)
      .forEach(t => deps.transactionService.softDelete(t.id));

    deps.importBatchService.getAll()
      .filter(b => b.accountId === id)
      .forEach(b => deps.importBatchService.delete(b.id));

    deps.conciliationService.getCycleCloses()
      .filter(cc => cc.cardId === id)
      .forEach(cc => deps.conciliationService.deleteCycleClose(cc.id));
    deps.conciliationService.getCycleSnapshots()
      .filter(s => s.cardId === id)
      .forEach(s => deps.conciliationService.deleteCycleSnapshot(s.id));

    deps.recurrentService.getAll()
      .filter(r => r.accountId === id)
      .forEach(r => deps.recurrentService.deleteWithMatches(r.id));

    this.storage.delete(STORAGE_KEYS.CREDIT_CARDS, id);
  }

  private refresh(): void {
    this._cards$.next(this.storage.getAll<CreditCard>(STORAGE_KEYS.CREDIT_CARDS));
  }
}
```

**Circular dependency note:** `CreditCardService` does not inject other services in its constructor. The `deps` object is passed by the UI component at call time. The UI component (which has all services injected normally) passes them as the `deps` argument. This avoids Angular circular dependency errors.

---

## Step 2 — `DebitAccountService`

File: `src/app/features/debit-accounts/services/debit-account.service.ts`

Copy from DESIGN_LOCAL_v5.md §6.7. Same pattern as CreditCardService.

`deleteWithCascade` here does NOT cascade to cycle closes/snapshots (debit accounts have no conciliation). It cascades: transactions (soft-delete) → import batches (delete) → recurrent transactions (deleteWithMatches) → account (delete).

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DebitAccount } from '../../../core/models/debit-account.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { TransactionService } from '../../transactions/services/transaction.service';
import { ImportBatchService } from '../../import/services/import-batch.service';
import { RecurrentTransactionService } from '../../recurrent-transactions/services/recurrent-transaction.service';

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

---

## Step 3 — `ImportBatchService`

File: `src/app/features/import/services/import-batch.service.ts`

Copy from DESIGN_LOCAL_v5.md §6.3.

Key method: `getLatestForAccount(accountId: string): ImportBatch | undefined` — returns the batch with the most recent `dateImport` for the given account. Used by balance computation.

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ImportBatch } from '../../../core/models/import-batch.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class ImportBatchService {
  private readonly _batches$ = new BehaviorSubject<ImportBatch[]>([]);
  readonly batches$: Observable<ImportBatch[]> = this._batches$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): ImportBatch[] { return this._batches$.getValue(); }

  getLatestForAccount(accountId: string): ImportBatch | undefined {
    return this.getAll()
      .filter(b => b.accountId === accountId)
      .sort((a, b) => b.dateImport.localeCompare(a.dateImport))[0];
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

---

## Directory Structure After This WP

```
src/app/features/
├── credit-cards/
│   └── services/
│       └── credit-card.service.ts
├── debit-accounts/
│   └── services/
│       └── debit-account.service.ts
└── import/
    └── services/
        └── import-batch.service.ts
```

The stub modules from WP02 already created the feature directories. Just add the `services/` subdirectory and the service files.

---

## Acceptance Criteria

- `npm run build` passes.
- `CreditCardService.save({strName:'Test',intClosingDay:15,intPaymentDay:5})` creates a new record in `localStorage` under `pfmg_credit_cards`.
- `CreditCardService.cards$` emits the updated list reactively when any `StorageService` write occurs.
- `ImportBatchService.getLatestForAccount()` returns `undefined` when no batches exist.
- No circular dependency errors in the build output.
