# Edge Cases — Business Logic Services

Design ref: BUSINESS_LOGIC.md §2–§5, DESIGN_LOCAL_v4.md §7.2–§7.5

---

## Duplication Detection (DuplicationLogicService)

### Floating-point amount comparison
- Rules A1, P1, P2, and P3 all compare `t.decAmount === row.amount` with strict equality. Floating-point values from Excel (via SheetJS) may differ from stored values at the 15th significant digit even when visually identical (e.g., `120.30 !== 120.30000000000001`). Use a tolerance: `Math.abs(t.decAmount - row.amount) < 0.001` instead of `===`.

### `existingTransactions` scope ambiguity in DuplicationLogicService
- The service's `annotate()` signature receives `existing: Transaction[]` with no documentation of whether it's pre-filtered by accountId/accountType. The call site in Step 1 description says "all ACTIVE transactions for the account being imported", but `BUSINESS_LOGIC.md §2.1` says "all ACTIVE transactions for the same account". If the caller ever passes the full transaction set (all accounts), D1 could flag a row as duplicate if *any* debit account happens to have the same operation number. The service should be defensive: add an `accountId` parameter and filter internally, or document the contract clearly.

### Rule D1 applied to credit card imports
- D1 is labeled "debit only" in the spec, but the check in `DuplicationLogicService` is `if (row.strOperationNumber)` — if a credit card Excel export happens to include an `N° Operacion` or `Operacion` column, `strOperationNumber` will be populated for those rows and D1 will execute. The existing-transaction filter `t.accountType === 'DEBIT_ACCOUNT'` prevents false matches, but the code path runs unnecessarily. Add an explicit `accountType` guard at the D1 branch.

### Rule P2 over-matching common amounts
- P2 matches any same amount within ±3 days regardless of description. For small, recurring amounts (bus fare, coffee) this generates noise. Consider adding an opt-out for P2 in user settings, or only applying P2 when the amount exceeds a minimum threshold (e.g., 10 PEN).

### No guard against matching across different accounts
- Rules P1–P3 check `t.decAmount === row.amount` and date proximity but do NOT check `t.accountId`. A transaction from Credit Card A for 500 PEN could POTENTIAL_DUPLICATE-flag an incoming row for Credit Card B. If `existing` is pre-filtered by account, this is fine; if not, cross-account false positives occur.

---

## Conciliation Algorithm (ConciliationCalculatorService)

### Closing day overflow at month boundaries
- `buildCycleWindow` creates `new Date(currentYear, currentMonth, intClosingDay)`. JavaScript's `Date` constructor overflows gracefully (e.g., `new Date(2026, 1, 30)` → March 2nd), but this shifts the closing date to the wrong month, corrupting the entire cycle window calculation. Cards with `intClosingDay = 29, 30, 31` will have wrong windows in months shorter than 31 days. Fix: clamp `intClosingDay` to `Math.min(intClosingDay, daysInMonth(year, month))`.

### Duplicate CycleClose records
- Nothing prevents the user from running conciliation twice for the same cycle. Each run creates a new `CycleClose` with the same `cardId` and `dateClosing`. On the next conciliation, `getMostRecentCycleClose` picks the latest by `dateClosing` string sort — if two records share the same `dateClosing`, the sort is non-deterministic. Add a guard: before saving, check for an existing `CycleClose` with `cardId === card.id && dateClosing === window.closingDate` and prompt "A cycle close already exists for this period. Overwrite?"

### Interest calculation on first cycle (no previous CycleClose)
- `previousClosingBalance` defaults to 0 when there are no prior cycle closes. This is correct only if the card has zero balance at inception. If the user imports transactions for a card they've had for months (catch-up import), the first conciliation will show a large "interest" amount that is actually the historical pre-import balance. The UI should explain that the first conciliation may require a manual opening-balance adjustment.

### `todayDate` drift
- `ConciliationCalculatorService.calculate()` receives `todayDate` as an input string, which the calling component constructs from `new Date().toISOString().slice(0, 10)`. If the user's system clock is wrong (or the device is in a different timezone), the cycle window could shift. No server time reference is available in the local-only variant — document the dependency on system clock accuracy.

### Post-close movements include PENDING transactions
- `postCloseMovementsSum` filters `input.activeTransactions`, which in the TransactionService context means calling `getActive()` — but that filters only `strStatus === 'ACTIVE'`. PENDING transactions are excluded from the formula. This is consistent across the spec but means that expected payments (marked PENDING) don't factor into the balance estimate. Decide explicitly: should PENDING transactions be included in conciliation math? Document either way.

---

## Recurrent Transaction Matching (RecurrentMatchingService)

### `intDayRange` is undefined
- The `findMatch` method checks `if (targetDate && r.intDayRange != null)` before applying the date range filter. If `intDayRange` is undefined, the date filter is skipped entirely — a transaction on any date can match the recurrent as long as amount and description criteria pass. This is undocumented behavior; the UI form should either require `intDayRange` for AUTOMATIC mode or clearly state "no date filter applied".

### Target date for days that don't exist
- `buildTargetDate` for MONTHLY constructs `${iterationKey}-${day}` (e.g., `2026-02-30`). This is not a valid ISO date; `new Date("2026-02-30")` returns `Invalid Date`. `daysDiff` then returns `NaN`, the comparison fails silently, and the match is skipped. For months where `intApproxDay > daysInMonth`, clamp to the last day of that month before comparing.

### YEARLY recurrents and past-iteration visibility
- The dashboard only shows the CURRENT iteration (YYYY for yearly). If the user adds a YEARLY recurrent in October for a charge due in January, the current iteration key is the year — but the target date is January of the following year. The NOT_YET_DUE check: `today < targetDate - intDayRange` would show NOT_YET_DUE for most of the current year, then PENDING in January. However, if January passes without a match and the user doesn't notice until February, the system has no way to "catch up" — the missed iteration is never shown after the iteration key rolls over. Consider showing the last N iterations per recurrent (not just the current one).

### No undo on manual match actions
- "Mark as done" and "Link transaction" both write a `RecurrentTransactionMatch` record. There is no delete/undo from the dashboard. If the user links the wrong transaction, they must go directly to localStorage to fix it. Add an "Unmark / Undo" action per DONE row that deletes the match record.

### Automatic matching at import: all-account scan
- Step 3 calls `recurrentMatchingService.findAutomaticMatches(recurrents, existingMatches, allActive, todayDate)` where `allActive` is all active transactions across all accounts. Inside `findMatch`, the account filter `t.accountId !== r.accountId` is correct. However, if there are thousands of active transactions, iterating over all of them for every AUTOMATIC recurrent is O(n×m). For typical usage this is fine, but for power users with years of data it may cause a noticeable pause after import.

---

## Transfer Logic

### No validation when linking existing transactions as a transfer (§6.4)
- The spec describes linking two already-imported transactions as a transfer by assigning them a shared `transferGroupId`. There is no guard against:
  - Linking two transactions that already belong to different transfer groups.
  - Linking two transactions from the same account (same account debit-to-debit "transfer" makes no sense).
  - Assigning a transferGroupId to more than 2 transactions.
- Add validation: only two transactions per `transferGroupId`; source and destination must be different accounts; neither transaction should already have a `transferGroupId`.

### Transfer amounts across currencies
- `createTransfer` sets `decAmount: -abs(amount)` and `decAmountPen: -abs(amountPen)`. If a debit-to-credit payment is made in USD (e.g., paying a USD credit card from a PEN account), the `amountPen` conversion must use an exchange rate. The transfer creation flow has no exchange-rate input. The spec does not address this case.
