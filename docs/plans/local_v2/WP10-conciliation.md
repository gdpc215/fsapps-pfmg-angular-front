# WP10 — Conciliation

**Depends on:** WP01, WP02, WP03, WP04, WP05, WP06  
**Spec:** DESIGN_LOCAL_v5.md §10; BUSINESS_LOGIC_v2.md §4

---

## Goal

Replace the conciliation stub module with two pages: a conciliation form for running a cycle reconciliation, and a history page showing past cycle closes. Conciliation is for credit cards only.

---

## `ConciliationModule`

File: `src/app/features/conciliation/conciliation.module.ts`

Routes:
```
''         → ConciliationFormComponent
'history'  → ConciliationHistoryComponent
```

Import: `SharedModule`, `ReactiveFormsModule`, `MatFormFieldModule`, `MatInputModule`, `MatSelectModule`, `MatCardModule`, `MatDividerModule`, `MatTableModule`, `MatIconModule`.

---

## `ConciliationFormComponent`

Files:
- `src/app/features/conciliation/pages/conciliation-form/conciliation-form.component.ts`
- `src/app/features/conciliation/pages/conciliation-form/conciliation-form.component.html`

### Inject
`CreditCardService`, `TransactionService`, `ConciliationService`, `ConciliationCalculatorService`, `MatDialog`, `Router`, `SnackbarService`

### Form
```typescript
form = new FormGroup({
  cardId:         new FormControl<string|null>(null, Validators.required),
  currentBalance: new FormControl<number|null>(null, [Validators.required, Validators.min(0)]),
});
```

### Template flow

**Step 1 — Inputs:**
- Card selector: `<mat-select>` listing all credit cards. On selection change: compute and display cycle window (auto-updates whenever cardId changes).
- Current balance input: positive number (the amount shown on the bank statement).
- Cycle window display (read-only, below the card selector): `Cycle: [cycleStart] → [closingDate]`.

**Cycle window auto-display:**
```typescript
get cycleWindow() {
  const card = this.creditCardService.getById(this.form.value.cardId);
  if (!card) return null;
  return this.calculator.buildCycleWindow(
    card.intClosingDay,
    new Date().toISOString().slice(0, 10)
  );
}
```

**"Calculate" button:**
- Validates form (both fields required).
- Loads `previousClosingBalance`:
  ```typescript
  const latestClose = this.conciliationService.getMostRecentCycleClose(cardId);
  const previousClosingBalance = latestClose?.decClosingBalance ?? 0;
  ```
- Calls `calculator.calculate({ cardId, intClosingDay, todayDate, currentBalance, previousClosingBalance, nonDeletedTransactions })`.
- Sets `result: ConciliationResult` on the component.

**First-cycle info note:** If `getMostRecentCycleClose(cardId)` returns `undefined`, show an amber info banner above the results:
> *"First reconciliation for this card — opening balance assumed 0. If the card had an existing balance before this import, adjust the interest amount manually."*

**Results table** (shown after Calculate):

| Label | Value |
|---|---|
| Cycle | `window.cycleStart` → `window.closingDate` |
| Opening balance | `result.openingBalance` formatted with `CurrencyPenPipe` |
| Cycle movements | `result.cycleMovementsSum` |
| **Expected closing (A)** | `result.amountA` |
| Current balance (entered) | `result.currentBalanceNegated` |
| Post-close movements | `result.postCloseMovementsSum` |
| **Implied closing (B)** | `result.amountB` |
| **Interest / Discrepancy** | `result.interestAmount` — red if ≠ 0, green (0) if zero |

**"Confirm" button** (enabled only when result is computed):

1. **Duplicate-cycle guard:**
   ```typescript
   if (this.conciliationService.existsCycleClose(cardId, window.closingDate)) {
     // open confirm dialog: "A cycle close already exists for [date]. Overwrite?"
     // on cancel: return
   }
   ```

2. If `result.interestAmount !== 0`: save interest transaction:
   ```typescript
   this.transactionService.save({
     accountId: cardId,
     accountType: 'CREDIT_CARD',
     dateTransaction: result.window.closingDate,
     strDescription: 'INTERES',
     strCurrency: 'PEN',
     decAmount: result.interestAmount,
     decAmountPen: result.interestAmount,
     strStatus: 'ACTIVE',
   });
   ```

3. Save cycle close:
   ```typescript
   this.conciliationService.saveCycleClose({
     cardId,
     dateClosing: result.window.closingDate,
     decOpeningBalance: result.openingBalance,
     decClosingBalance: result.amountB,
     decInterestAmount: result.interestAmount,
     interestTransactionId: interestTxn?.id,
   });
   ```

4. Save cycle snapshot:
   ```typescript
   this.conciliationService.saveCycleSnapshot({
     cardId,
     dateSnapshot: result.window.closingDate,
     decBalanceAtSnapshot: result.amountB,
     strType: 'CYCLE_CLOSE',
   });
   ```

5. Show success toast: *"Cycle closed. Discrepancy recorded: S/ X.XX"* (or "No discrepancy" if 0).
6. Navigate to `'/conciliation/history'`.

---

## `ConciliationHistoryComponent`

Files:
- `src/app/features/conciliation/pages/conciliation-history/conciliation-history.component.ts`
- `src/app/features/conciliation/pages/conciliation-history/conciliation-history.component.html`

### Data
```typescript
cards$       = creditCardService.cards$;
cycleCloses$ = conciliationService.cycleCloses$;
```

### Template

Page title: "Conciliation History" + `[Run Conciliation]` button → navigate to `'/conciliation'`.

**Card filter:** `<mat-select>` to filter by card (default: all cards).

**Table** (sorted by `dateClosing` DESC):

| Closing Date | Card | Opening Balance | Closing Balance | Interest |
|---|---|---|---|---|
| `cc.dateClosing` | card name | `cc.decOpeningBalance` | `cc.decClosingBalance` | `cc.decInterestAmount` (red if ≠0) |

**Empty state:** *"No cycle closes recorded yet. Run a reconciliation to start tracking cycles."*

---

## Acceptance Criteria

- Selecting a card auto-displays the computed cycle window.
- "Calculate" with a valid balance shows the full results table.
- First reconciliation shows the info note about opening balance = 0.
- Overwrite guard fires when a cycle close already exists for the computed date.
- Interest transaction created with `strDescription = 'INTERES'` when discrepancy ≠ 0.
- History page shows all cycle closes sorted by date DESC.
- History empty state shown when no closes exist.
