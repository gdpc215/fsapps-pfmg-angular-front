# WP12 — Transaction Explorer

**Depends on:** WP01, WP02, WP03, WP05  
**Spec:** DESIGN_LOCAL_v5.md §12

---

## Goal

Replace the explorer stub module with a filterable transaction explorer. No writes — read-only view.

---

## `ExplorerModule`

File: `src/app/features/explorer/explorer.module.ts`

Routes: `''` → `TransactionExplorerComponent`

Import: `SharedModule`, `ReactiveFormsModule`, `MatFormFieldModule`, `MatInputModule`, `MatSelectModule`, `MatDatepickerModule`, `MatNativeDateModule`, `MatTableModule`, `MatIconModule`, `MatDividerModule`, `MatChipsModule`.

---

## `TransactionExplorerComponent`

Files:
- `src/app/features/explorer/pages/transaction-explorer/transaction-explorer.component.ts`
- `src/app/features/explorer/pages/transaction-explorer/transaction-explorer.component.html`

### Inject
`TransactionService`, `CategoryService`, `CreditCardService`, `DebitAccountService`

### Filter state (reactive)

Use a `FormGroup` so all filter fields are reactive:

```typescript
filterForm = new FormGroup({
  categoryId:    new FormControl<string|null>(null),
  subcategoryId: new FormControl<string|null>(null),
  accountId:     new FormControl<string|null>(null),
  textSearch:    new FormControl<string>(''),
  dateFrom:      new FormControl<string|null>(null),
  dateTo:        new FormControl<string|null>(null),
  amountMin:     new FormControl<number|null>(null),
  amountMax:     new FormControl<number|null>(null),
});
```

When `categoryId` changes: reset `subcategoryId` to null (subcategories are filtered by category).

### Computed results

```typescript
get filteredTransactions(): Transaction[] {
  const f = this.filterForm.value;
  let results = this.transactionService.getAll().filter(t => t.strStatus !== 'DELETED');

  if (f.subcategoryId) results = results.filter(t => t.subcategoryId === f.subcategoryId);
  else if (f.categoryId) {
    const subIds = this.categoryService.getSubcategoriesByCategoryId(f.categoryId).map(s => s.id);
    results = results.filter(t => t.subcategoryId && subIds.includes(t.subcategoryId));
  }

  if (f.accountId)   results = results.filter(t => t.accountId === f.accountId);
  if (f.textSearch)  results = results.filter(t =>
    t.strDescription.toLowerCase().includes(f.textSearch!.toLowerCase())
  );
  if (f.dateFrom)    results = results.filter(t => t.dateTransaction >= f.dateFrom!);
  if (f.dateTo)      results = results.filter(t => t.dateTransaction <= f.dateTo!);
  if (f.amountMin != null) results = results.filter(t => Math.abs(t.decAmountPen) >= f.amountMin!);
  if (f.amountMax != null) results = results.filter(t => Math.abs(t.decAmountPen) <= f.amountMax!);

  return results.sort((a, b) => b.dateTransaction.localeCompare(a.dateTransaction));
}

get aggregateTotal(): number {
  return this.filteredTransactions.reduce((s, t) => s + t.decAmountPen, 0);
}
```

Use `valueChanges` on `filterForm` to trigger change detection — subscribe in `ngOnInit` and call `markForCheck()` (inject `ChangeDetectorRef`).

### Template

**Filter panel** (row of filter inputs):
```
[Category ▼] [Subcategory ▼] [Account ▼] [Search description...]
[Date from] [Date to] [Amount min] [Amount max]
```

- Category `<mat-select>`: lists all categories. Default: "All categories".
- Subcategory `<mat-select>`: shows subcategories for the selected category only. Disabled when no category selected.
- Account `<mat-select>` with `<mat-optgroup>` for credit cards and debit accounts. Default: "All accounts".
- Date inputs: `<mat-form-field><input matInput>` with type="date" or a text input accepting `YYYY-MM-DD`. Keep simple — no datepicker required.
- Amount min/max: number inputs.

**Results table:**

| Date | Account | Description | Amount | Status |
|---|---|---|---|---|
| `t.dateTransaction` (dd/MM/yyyy) | account name | `t.strDescription` | `t.decAmountPen` (colored) | ACTIVE/PENDING badge |

**Aggregate row** (below table, always visible):
```
N transactions · Total: S/ X.XX
```
Total colored by sign (red if negative, green if positive).

**Empty states:**
- No category selected AND `subcategoryId` also null AND `accountId` null: *"Use the filters above to explore your transactions."*
- Filters set but no results: *"No transactions match your current filters."*

### Resolve account name helper

```typescript
resolveAccountName(t: Transaction): string {
  if (t.accountType === 'CREDIT_CARD') {
    return this.creditCardService.getById(t.accountId)?.strName ?? '(unknown)';
  }
  return this.debitAccountService.getById(t.accountId)?.strName ?? '(unknown)';
}
```

---

## `TransactionsModule` (basic list)

The stub created in WP02 also covers a `transactions` route used as the post-import destination for debit accounts. Replace it with a minimal transaction list:

File: `src/app/features/transactions/transactions.module.ts`

Route `''` → `TransactionListComponent`. This is a simplified view:
- Page title: "Transactions"
- Shows all non-DELETED transactions sorted by date DESC.
- Columns: Date, Account, Description, Amount, Status.
- A "Go to Explorer" button linking to `/explorer`.
- No filters needed (Explorer covers filtering).

This module shares `TransactionService`, `CreditCardService`, `DebitAccountService` already provided root-level.

---

## Acceptance Criteria

- Selecting a category filters subcategory dropdown to only that category's subcategories.
- Changing the category resets the subcategory selection.
- All filter combinations work correctly together.
- Aggregate total updates reactively as filters change.
- Results sorted by `dateTransaction` DESC.
- DELETED transactions never appear.
- Account names resolve correctly for both credit cards and debit accounts.
