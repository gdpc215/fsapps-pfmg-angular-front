# Edge Cases — Views, Dashboards, and Explorer

Design ref: DESIGN_LOCAL_v4.md §11–§14, BUSINESS_LOGIC.md §5.6, §10

---

## Recurrent Dashboard (§11)

### Status when `targetDate` is undefined
- If a recurrent has no `intApproxDay` set, `buildTargetDate` returns `undefined`. The status logic then falls to: `if (match?.boolDone) → DONE; else if (targetDate && today < targetDate - intDayRange) → NOT_YET_DUE; else → PENDING`. With `targetDate = undefined`, the second branch is always false, so every unmatched recurrent without a target date is always PENDING — even one that was just created and is not expected for months. MANUAL mode recurrents are especially likely to have no target date. Consider a separate "no target configured" status or treat MANUAL-mode recurrents without a target date differently.

### `intDayRange` undefined in NOT_YET_DUE check
- `today < targetDate - r.intDayRange`: if `intDayRange` is undefined, `targetDate - undefined = NaN` and the comparison is `false`. The recurrent jumps to PENDING immediately after creation regardless of when it is due. Validate that `intDayRange` is always set for AUTOMATIC mode; for MANUAL mode, skip the NOT_YET_DUE check entirely.

### "Link transaction" dialog: no search or filter
- The dialog lists ALL ACTIVE transactions for the same `accountId`, sorted by date DESC. For a card with 3 years of history this is 1,800+ rows. The user must scroll to find the right transaction. Add a search/filter by description or date range within the dialog.

### No pagination in "Link transaction" dialog
- Loading thousands of transactions into a `MatDialog` with a `<mat-list>` will render all rows immediately, causing jank. Use virtual scrolling (`cdk-virtual-scroll-viewport`) or paginate by default (show last 30, load more).

### Bulk actions missing
- If many PENDING recurrents exist (e.g., after a long period without logging in), the user must "Mark as done" one at a time. A "Mark all as done" bulk action would help.

### YEARLY recurrents: no historical iteration display
- The dashboard shows only the current iteration key. A YEARLY recurrent for an event that occurred in February and today is June shows DONE for the current year — which is correct — but the user cannot see prior years' match history from this view. Consider a "History" expansion per row.

---

## Transaction Explorer (§12)

### No virtual scrolling / pagination
- The results list renders all matching transactions in a `*ngFor`. With a broad subcategory (e.g., "Alimentación" with 1,000+ transactions), the DOM renders all rows at once, causing scroll jank and high memory use. Implement `cdk-virtual-scroll-viewport` or server-side (localStorage-side) pagination.

### No text search within results
- The explorer filters by subcategory only. To answer "when did I pay Claro?" the user must know Claro's subcategory first. Add an optional free-text filter on `strDescription` within the results.

### No date-range filter
- "How much did I spend on streaming in 2025?" requires scrolling through all results to mentally sum. Add optional date-from / date-to inputs to narrow the result set.

### No amount range filter
- Large purchases within a subcategory cannot be isolated without scrolling. Useful for "find all grocery trips over 200 PEN".

### Orphaned subcategoryId on deleted subcategory
- If a `Subcategory` is deleted from the category management screen, transactions that reference its `subcategoryId` are NOT updated (no cascade). These transactions still have the old `subcategoryId` in storage. In the Explorer, the subcategory won't appear in the dropdown, so those transactions become unreachable via the Explorer. They still appear in the transaction list, but their subcategory shows as blank or "(unknown)". Add a data-integrity warning when deleting a subcategory that has associated transactions, and offer to reassign or clear the reference.

### No results aggregate / totals
- The Explorer shows individual rows but not a total for the filtered set. "How much have I spent on subscriptions total?" requires mental math. Show a summary row: count of transactions, sum of `decAmountPen`.

---

## Monthly Dashboard (§13)

### Month string arithmetic
- "← Previous" / "Next →" must manipulate the `'YYYY-MM'` string by ±1 month. Naive string manipulation (`parseInt(month.slice(5, 7)) - 1`) fails at January (month 01 → 00, year doesn't roll back). Use proper date math: `new Date(year, month - 1, 1)` → subtract/add one month → format back to `'YYYY-MM'`.

### Future month navigation
- "Next →" has no upper bound — the user can navigate to 2099-12. For future months, all totals are zero (no transactions yet). Show a clear "No data for future months" state, or disable "Next →" when `selectedMonth >= currentMonth`.

### Transfer noise in income/expense breakdown
- Inter-account transfers produce a debit on the source (counted as expense) and a credit on the destination (counted as income). The net is zero across accounts, but in the breakdown both appear — a 1,000 PEN transfer inflates both income and expenses by 1,000 PEN. Consider adding a "transfers" row or a toggle to exclude `transferGroupId !== undefined` transactions.

### Uncategorized total includes both income and expenses
- `uncategorizedTotal` sums all uncategorized `decAmountPen` values together (positive and negative). A month with 500 PEN uncategorized income and −300 PEN uncategorized expense shows `uncategorizedTotal = 200`. This obscures the magnitude. Show separate uncategorized income and expense rows.

### PENDING transactions included without visual distinction
- `computeMonthly` includes PENDING transactions in all totals. The UI doesn't differentiate amounts from PENDING vs. ACTIVE transactions. A large PENDING transaction (e.g., an expected mortgage payment) skews the totals without the user realizing it is not yet confirmed. Consider a footnote: "Includes N pending transactions (X.XX PEN)".

---

## Cycle Dashboard (§14)

### `decCurrentBalance` staleness
- The "Current balance" shown is `card.decCurrentBalance`, which is updated after each import and conciliation. Between imports, it is stale — it reflects the balance at last import, not today. This may be hours or weeks old. Label it clearly: "Balance as of last import (date)" to avoid user confusion.

### ACTIVE-only vs. ACTIVE+PENDING inconsistency
- `computeCycleSummary` filters `t.strStatus === 'ACTIVE'` — PENDING transactions are excluded. `computeMonthly` includes PENDING. This inconsistency means a transaction marked "pending" after import appears in the monthly dashboard but not the cycle dashboard. Align to a consistent policy: include PENDING in both or neither, and document it.

### Closing day overflow
- Same issue as in ConciliationCalculatorService: `new Date(currentYear, currentMonth, intClosingDay)` overflows for months shorter than `intClosingDay`. A card with `intClosingDay = 31` in February will have its cycle window pushed into March, making all February cycle transactions appear outside the window. Clamp to end-of-month.

### No cards registered
- If `creditCardService.getAll()` returns `[]`, the cycle dashboard shows nothing. Add an empty state with a call-to-action: "No credit cards configured. Add one to see cycle summaries."

### Cards with no transactions in current cycle
- `computeCycleSummary` returns `transactionCount: 0` and empty `topSubcategories`. The card widget should show a placeholder: "No transactions in current cycle (YYYY-MM-DD → YYYY-MM-DD)."

### `computeCycleSummary` called on init only
- The component computes `cardSummaries` once on `ngOnInit`. If the user imports data in another tab (or elsewhere in the same tab) and then navigates back to the cycle dashboard, the data is stale. Subscribe to `TransactionService.transactions$` and recompute on every emission.

### Top subcategories sorting is not stable
- `topSubcategories` sorts by `abs(total)` descending. If two subcategories have the same absolute total, their order is non-deterministic across renders. Use a secondary sort by `subcategoryName` as a tiebreaker.
