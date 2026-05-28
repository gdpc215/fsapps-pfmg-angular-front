# WP11 — Recurrent Transactions

**Depends on:** WP01, WP02, WP03, WP04, WP05, WP06  
**Spec:** DESIGN_LOCAL_v5.md §11; BUSINESS_LOGIC_v2.md §5

---

## Goal

Replace the recurrent-transactions stub module with three pages: a list of configured recurrents, a form for creating/editing them, and a dashboard for tracking iteration status.

---

## `RecurrentTransactionsModule`

File: `src/app/features/recurrent-transactions/recurrent-transactions.module.ts`

Routes:
```
''           → RecurrentListComponent
'new'        → RecurrentFormComponent
':id/edit'   → RecurrentFormComponent
'dashboard'  → RecurrentDashboardComponent
```

Import: `SharedModule`, `ReactiveFormsModule`, `MatCardModule`, `MatFormFieldModule`, `MatInputModule`, `MatSelectModule`, `MatRadioModule`, `MatTableModule`, `MatChipsModule`, `MatIconModule`, `MatDividerModule`, `MatButtonModule`.

---

## `RecurrentListComponent`

Files:
- `src/app/features/recurrent-transactions/pages/recurrent-list/recurrent-list.component.ts`
- `src/app/features/recurrent-transactions/pages/recurrent-list/recurrent-list.component.html`

**Inject:** `RecurrentTransactionService`, `CreditCardService`, `DebitAccountService`, `MatDialog`, `Router`

**Template:**
- Page title: "Recurring Transactions" + `[Add Recurrent]` button + `[Open Dashboard]` button.
- Empty state: *"No recurring transactions configured. Add one to start tracking."*
- Table columns: Name, Account, Frequency, Mode (MANUAL/AUTOMATIC), Expected Amount, Actions (`[Edit]` `[Delete]`).
- Delete confirm: *"Delete '[r.strName]'? Its match history will also be removed."* (danger).
- `deleteWithMatches(id)` on confirm.

**Resolve account name helper:**
```typescript
getAccountName(accountId: string, accountType: AccountType): string {
  if (accountType === 'CREDIT_CARD') {
    return this.creditCardService.getById(accountId)?.strName ?? '(unknown)';
  }
  return this.debitAccountService.getById(accountId)?.strName ?? '(unknown)';
}
```

---

## `RecurrentFormComponent`

Files:
- `src/app/features/recurrent-transactions/pages/recurrent-form/recurrent-form.component.ts`
- `src/app/features/recurrent-transactions/pages/recurrent-form/recurrent-form.component.html`

**Inject:** `RecurrentTransactionService`, `CreditCardService`, `DebitAccountService`, `ActivatedRoute`, `Router`, `SnackbarService`

### Form structure

```typescript
form = new FormGroup({
  strName:        new FormControl('', [Validators.required]),
  strNotes:       new FormControl(''),
  accountId:      new FormControl<string|null>(null, Validators.required),
  // accountType derived from selection
  strFrequency:   new FormControl<'MONTHLY'|'YEARLY'>('MONTHLY', Validators.required),
  strMatchMode:   new FormControl<'MANUAL'|'AUTOMATIC'>('MANUAL', Validators.required),
  // AUTOMATIC-only fields:
  strCurrency:    new FormControl<string|null>(null),
  decApproxAmount: new FormControl<number|null>(null),
  decAmountRange: new FormControl<number|null>(0),
  strMatchString: new FormControl<string|null>(null),
  intApproxDay:   new FormControl<number|null>(null),
  intApproxMonth: new FormControl<number|null>(null),  // YEARLY only
  intDayRange:    new FormControl<number|null>(null),
});
```

**Account selector:** `<mat-select>` with `<mat-optgroup>` for credit cards and debit accounts (same pattern as import wizard). Store both `accountId` and `accountType` (derive `accountType` from which group the selected account belongs to).

**Conditional AUTOMATIC fields:** Use `*ngIf="form.value.strMatchMode === 'AUTOMATIC'"` to show/hide the AUTOMATIC-mode fields. When AUTOMATIC is selected, apply validators:
- `decApproxAmount`: required
- `strMatchString`: required
- `intDayRange`: required, min(0)
- `intApproxDay`: min(1), max(31)

When mode changes to MANUAL, clear those validators programmatically (`control.clearValidators(); control.updateValueAndValidity()`).

**YEARLY-only field:** `intApproxMonth` shown only when `strFrequency === 'YEARLY'`.

**On submit:**
```typescript
const data: Partial<RecurrentTransaction> = {
  ...existingRecurrent,
  strName:       form.value.strName,
  strNotes:      form.value.strNotes || undefined,
  accountId:     selectedAccountId,
  accountType:   selectedAccountType,
  strFrequency:  form.value.strFrequency,
  strMatchMode:  form.value.strMatchMode,
  ...(form.value.strMatchMode === 'AUTOMATIC' ? {
    strCurrency:     form.value.strCurrency || undefined,
    decApproxAmount: form.value.decApproxAmount!,
    decAmountRange:  form.value.decAmountRange ?? 0,
    strMatchString:  form.value.strMatchString!,
    intApproxDay:    form.value.intApproxDay || undefined,
    intApproxMonth:  form.value.strFrequency === 'YEARLY' ? form.value.intApproxMonth || undefined : undefined,
    intDayRange:     form.value.intDayRange!,
  } : {
    strCurrency: undefined, decApproxAmount: undefined,
    decAmountRange: undefined, strMatchString: undefined,
    intApproxDay: form.value.intApproxDay || undefined,
    intDayRange: undefined,
  }),
};
recurrentTransactionService.save(data);
snackbar.success(isEdit ? 'Updated.' : 'Added.');
router.navigate(['/recurrent-transactions']);
```

---

## `RecurrentDashboardComponent`

Files:
- `src/app/features/recurrent-transactions/pages/recurrent-dashboard/recurrent-dashboard.component.ts`
- `src/app/features/recurrent-transactions/pages/recurrent-dashboard/recurrent-dashboard.component.html`

**Inject:** `RecurrentTransactionService`, `CreditCardService`, `DebitAccountService`, `TransactionService`, `RecurrentMatchingService`, `MatDialog`, `SnackbarService`

### Data computation (recomputed on every `transactions$` emission)

```typescript
todayDate       = new Date().toISOString().slice(0, 10);
recurrents      = recurrentTransactionService.getAll();
allMatches      = recurrentTransactionService.getAllMatches();
activeTransactions = transactionService.getActive();

// For each recurrent, compute rows for last 2 iteration keys
dashboardRows = recurrents.map(r => ({
  recurrent: r,
  accountName: resolveAccountName(r),
  rows: getIterationKeys(r).map(key => ({
    key,
    targetDate: recurrentMatchingService.buildTargetDate(r, key),
    status: computeStatus(r, key),
    match: allMatches.find(m => m.recurrentTransactionId === r.id && m.strIterationKey === key),
  }))
}));
```

**`getIterationKeys(r)`:** returns `[currentKey, previousKey]` using `RecurrentMatchingService.getCurrentIterationKey()` and `getPreviousIterationKey()`.

**`computeStatus(r, iterationKey)`:**
```typescript
const match = allMatches.find(m => m.recurrentTransactionId === r.id && m.strIterationKey === iterationKey);
if (match?.boolDone) return 'DONE';

const targetDate = recurrentMatchingService.buildTargetDate(r, iterationKey);
if (!targetDate) return 'NOT_CONFIGURED';

const dayRange = r.intDayRange ?? 0;
const windowOpen = new Date(new Date(targetDate).getTime() - dayRange * 86_400_000);
return new Date(todayDate) < windowOpen ? 'NOT_YET_DUE' : 'PENDING';
```

### Sort order
Sort `dashboardRows` by priority: PENDING first → NOT_YET_DUE → NOT_CONFIGURED → DONE. Within status, sort by `r.strName`.

### Template

**Header:** "Recurrent Dashboard" + `[Mark all PENDING as done]` button (only enabled when any current-iteration rows are PENDING).

**Empty state:** *"No recurring transactions configured. Add them in Recurrent Transactions →"*

**Status badges** (mat-chip with color):
- `DONE` → green
- `PENDING` → amber/warn
- `NOT_YET_DUE` → gray
- `NOT_CONFIGURED` → muted gray

For each recurrent, display two rows (current + previous iteration):

| Name | Account | Freq | Iteration | Expected Date | Status | Matched On | Actions |
|---|---|---|---|---|---|---|---|

**Previous-iteration row styling:**
- If DONE: muted (opacity-60).
- If PENDING: red text ("Missed").

**Actions per row:**
- Current iteration, PENDING → `[Mark as done]` + `[Link transaction]`
- Any iteration, DONE → `[Unlink / Undo]`

**"Mark as done":**
```typescript
recurrentTransactionService.saveMatch({
  recurrentTransactionId: r.id,
  strIterationKey: currentKey,
  transactionId: undefined,
  boolDone: true,
  dateDone: todayDate,
  strMatchMode: 'MANUAL',
});
snackbar.success('Marked as done.');
```

**"Link transaction":** Opens a `MatDialog` with a list of ACTIVE transactions for `r.accountId` sorted by `dateTransaction` DESC. User selects one. On confirm:
```typescript
recurrentTransactionService.saveMatch({
  recurrentTransactionId: r.id,
  strIterationKey: currentKey,
  transactionId: selectedTxn.id,
  boolDone: true,
  dateDone: todayDate,
  strMatchMode: 'MANUAL',
});
```

**"Unlink / Undo":** `recurrentTransactionService.deleteMatch(match.id)` + snackbar.

**"Mark all as done":** iterate all recurrents where current-iteration status is PENDING, save a match record for each.

---

## Acceptance Criteria

- Recurrent list shows all configured recurrents with account name, frequency, mode.
- Delete with cascade removes match records too.
- Form shows AUTOMATIC fields only when mode is AUTOMATIC; YEARLY month field only when frequency is YEARLY.
- Dashboard shows exactly 2 rows per recurrent (current + previous iteration).
- Status computation matches the algorithm in BUSINESS_LOGIC_v2.md §5.7.
- "Mark as done" creates a match record with `boolDone: true` and `strMatchMode: 'MANUAL'`.
- "Unlink" deletes the match record, reverting the row to PENDING/NOT_YET_DUE.
- Previous-iteration PENDING rows are styled red.
- "Mark all PENDING as done" processes all pending current-iteration rows.
