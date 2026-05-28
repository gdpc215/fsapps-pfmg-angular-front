# WP07 — Credit Cards & Debit Accounts Pages

**Depends on:** WP01, WP02, WP03, WP04, WP05  
**Spec:** DESIGN_LOCAL_v5.md §8, §6.1, §6.7

---

## Goal

Replace the stub modules for `credit-cards` and `debit-accounts` with real pages: a list page and a form page for each. Both accounts types have no balance field in the form (balance is derived from import batches, not stored).

---

## Part A — Credit Cards Feature

### A1. `CreditCardsModule`

File: `src/app/features/credit-cards/credit-cards.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { ReactiveFormsModule } from '@angular/forms';
import { CardListComponent } from './pages/card-list/card-list.component';
import { CardFormComponent } from './pages/card-form/card-form.component';

const routes: Routes = [
  { path: '', component: CardListComponent },
  { path: 'new', component: CardFormComponent },
  { path: ':id/edit', component: CardFormComponent },
];

@NgModule({
  declarations: [CardListComponent, CardFormComponent],
  imports: [
    SharedModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatCardModule, MatFormFieldModule, MatInputModule, MatIconModule, MatTableModule,
  ],
})
export class CreditCardsModule {}
```

### A2. `CardListComponent`

Files:
- `src/app/features/credit-cards/pages/card-list/card-list.component.ts`
- `src/app/features/credit-cards/pages/card-list/card-list.component.html`

**Component:**
- Inject: `CreditCardService`, `TransactionService`, `ImportBatchService`, `ConciliationService`, `RecurrentTransactionService`, `MatDialog`, `Router`, `SnackbarService`.
- `cards$ = creditCardService.cards$`
- `computeBalance(cardId)` — calls `importBatchService.getLatestForAccount(cardId)`; returns `{ balance: number, dateImport: string|undefined }`.

**Template:**
- Page title: "Credit Cards"
- `[Add Credit Card]` button → navigate to `credit-cards/new`.
- Empty state: *"No credit cards configured yet. Add your first card to get started."*
- List of cards (mat-card or table rows). Each card shows:
  - Name (`strName`)
  - Closing day: `intClosingDay`
  - Payment day: `intPaymentDay`
  - Balance at last import (from `computeBalance`)
- Action buttons per card: `[Edit]` → navigate to `credit-cards/:id/edit`; `[Delete]` → confirm dialog then `deleteWithCascade`.

**Delete confirm dialog:**
```
Title: "Delete card?"
Message: "Deleting '[card.strName]' will also remove all its transactions, import batches, and cycle records. This cannot be undone."
danger: true
```

After confirmed delete: call `creditCardService.deleteWithCascade(id, { transactionService, importBatchService, conciliationService, recurrentService })`, then show success snackbar.

### A3. `CardFormComponent`

Files:
- `src/app/features/credit-cards/pages/card-form/card-form.component.ts`
- `src/app/features/credit-cards/pages/card-form/card-form.component.html`

**Component:**
- Inject: `CreditCardService`, `ActivatedRoute`, `Router`, `SnackbarService`.
- On init: if `:id` param present, load existing card and patch form.
- `isEdit = !!route.snapshot.paramMap.get('id')`.

**Reactive form:**
```typescript
form = new FormGroup({
  strName:       new FormControl('', [Validators.required, Validators.maxLength(100)]),
  intClosingDay: new FormControl<number|null>(null, [Validators.required, Validators.min(1), Validators.max(31)]),
  intPaymentDay: new FormControl<number|null>(null, [Validators.required, Validators.min(1), Validators.max(31)]),
});
```

**On submit:**
```typescript
const data = { ...existingCard, ...form.value };
creditCardService.save(data);
snackbar.success(isEdit ? 'Card updated.' : 'Card added.');
router.navigate(['/credit-cards']);
```

**Template:**
- Page title: "New Credit Card" or "Edit Credit Card".
- Form fields: Name, Closing Day (1–31), Payment Day (1–31).
- Inline validation errors per field.
- `[Save]` and `[Cancel]` buttons.

---

## Part B — Debit Accounts Feature

### B1. `DebitAccountsModule`

File: `src/app/features/debit-accounts/debit-accounts.module.ts`

Same structure as CreditCardsModule. Routes: `''` → list, `'new'` → form, `':id/edit'` → form. Components: `DebitAccountListComponent`, `DebitAccountFormComponent`.

### B2. `DebitAccountListComponent`

Same structure as `CardListComponent` but:
- Uses `DebitAccountService.accounts$`.
- No conciliation service in `deleteWithCascade` deps (debit accounts have no cycle closes).
- Balance display same pattern — uses `ImportBatchService.getLatestForAccount()`.
- Empty state: *"No debit accounts configured yet."*

### B3. `DebitAccountFormComponent`

Same structure as `CardFormComponent` but:
- Only field: `strName` (required, maxLength 100).
- No closing day or payment day.
- Uses `DebitAccountService.save()`.
- Form: `new FormGroup({ strName: new FormControl('', [Validators.required, Validators.maxLength(100)]) })`.

---

## Shared Display Pattern for Both Account Lists

For the balance display, use a template-level helper:

```typescript
getBalanceInfo(accountId: string): { balance: number; dateImport: string | undefined } {
  const batch = this.importBatchService.getLatestForAccount(accountId);
  return { balance: batch?.decBalanceAtImport ?? 0, dateImport: batch?.dateImport };
}
```

Display: `S/ -1,250.00 (as of 10/05/2026)` — use `CurrencyPenPipe` for amount, `DatePipe` with `'dd/MM/yyyy'` for date. If no batch: show `—` for balance.

---

## Acceptance Criteria

- Both list pages navigate to their form pages via router.
- Form validates `intClosingDay`/`intPaymentDay` as 1–31; shows inline errors for out-of-range values.
- Debit account form has no closing/payment day fields.
- Delete opens a confirm dialog; canceling does nothing; confirming cascades and shows snackbar.
- After save, redirects to the list page.
- Empty state renders when no accounts exist.
- Balance shows "as of" date when an import batch exists.
