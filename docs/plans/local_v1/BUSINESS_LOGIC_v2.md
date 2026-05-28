# Business Logic Reference — fsapps-pfmg

**Version:** 2.0
**Date:** 2026-05-20
**Project:** fsapps-pfmg
**Purpose:** Authoritative specification of all algorithms, decision trees, and rule systems.

### Changes from v1 → v2

- §2 Duplication Detection: added `accountId` + `accountType` + `boolP2Enabled` parameters; float tolerance on all amount comparisons; P2 is opt-in.
- §4 Conciliation: `buildCycleWindow` clamps closing day to end-of-month; post-close movements now include PENDING; input renamed to `nonDeletedTransactions`.
- §5 Recurrent Matching: `buildTargetDate` clamps day to last day of month; `NOT_CONFIGURED` status added; dashboard shows last 2 iterations.
- §6 Transfer Logic: added validation rules.
- §8 Import Wizard: file validation guards; deletion-intent pattern; try-catch on save; account-type-conditional routing.
- §9 Excel Parsing: local-timezone date fix; `parseAmount` helper with comma stripping and 0-on-NaN; enriched return with `hasUsdRows` and `hasMultipleSheets`.
- §10 Monthly Dashboard: split uncategorized into income/expense; PENDING footnote fields; transfers toggle support.
- §11 Balance Computation: new section replacing stored `decCurrentBalance`.

**Scope note:** This app runs locally for a single user with a maximum of ~1 000 transactions. No performance optimizations (virtual scrolling, pagination, caching) are needed. All algorithms can operate on the full in-memory dataset without concern.

---

## Table of Contents

1. [Transaction Amounts and Sign Convention](#1--transaction-amounts-and-sign-convention)
2. [Duplication Detection Algorithm](#2--duplication-detection-algorithm)
3. [Category Auto-Matching Algorithm](#3--category-auto-matching-algorithm)
4. [Cycle Conciliation Algorithm (Credit Cards Only)](#4--cycle-conciliation-algorithm-credit-cards-only)
5. [Recurrent Transaction Matching Algorithm](#5--recurrent-transaction-matching-algorithm)
6. [Transfer Logic](#6--transfer-logic)
7. [Transaction Status Transitions](#7--transaction-status-transitions)
8. [Import Wizard Decision Flow](#8--import-wizard-decision-flow)
9. [Excel Parsing Rules](#9--excel-parsing-rules)
10. [Monthly Dashboard Calculation](#10--monthly-dashboard-calculation)
11. [Balance Computation](#11--balance-computation)

---

## 1 — Transaction Amounts and Sign Convention

**Rule:** All amounts follow the bank statement sign convention.

- Negative amount (`decAmount < 0`) = charge or outgoing payment (money leaving the account).
- Positive amount (`decAmount > 0`) = payment, refund, or incoming transfer (money returning to or entering the account).
- `decAmountPen` is always in PEN. For USD transactions, `decAmountPen = decAmount × usdExchangeRate` at import time; never re-converted later.
- Credit card balances are stored as negative when owed (e.g., "you owe 1 500 PEN" is stored as `−1 500`).
- Debit account balances are positive (savings balance).
- During import, the user enters the current balance as a positive number; the import batch stores:
  - Credit card: `decBalanceAtImport = -Math.abs(enteredBalance)` (negative = owed)
  - Debit account: `decBalanceAtImport = Math.abs(enteredBalance)` (positive = savings)
- **`decCurrentBalance` is NOT stored on `CreditCard` or `DebitAccount` models.** Balance is always derived on the fly from the latest `ImportBatch.decBalanceAtImport` for the account. See §11.

---

## 2 — Duplication Detection Algorithm

This algorithm runs during the import wizard Step 1 → Step 2 transition. It annotates each incoming row against existing ACTIVE transactions for the same account.

### 2.1 Input

```
incoming:      RawImportRow[]
existing:      Transaction[]       — all transactions (any status); service filters internally
collections:   DuplicationCollection[]
accountId:     string              — used to pre-filter existing transactions
accountType:   AccountType         — 'CREDIT_CARD' | 'DEBIT_ACCOUNT'
boolP2Enabled: boolean             — opt-in flag for rule P2
```

### 2.2 Pre-processing

```
activeForAccount = existing.filter(t =>
  t.accountId === accountId AND t.strStatus === 'ACTIVE'
)
```

All rules run against `activeForAccount`, not the raw `existing` input. This prevents cross-account false positives.

### 2.3 Output

Each incoming row is annotated with:

- `flag: 'NONE' | 'AUTO_DUPLICATE' | 'POTENTIAL_DUPLICATE'`
- `matchingTransaction?: Transaction` — the existing transaction that triggered the flag
- `checked: boolean` — `false` for AUTO_DUPLICATE (skipped by default), `true` for all others

### 2.4 Amount comparison

All amount comparisons use a float tolerance of **0.001** to avoid floating-point precision issues from SheetJS parsing:

```
amountsMatch(a, b) = Math.abs(a - b) < 0.001
```

### 2.5 Rules (evaluated in order; first match wins)

**Rule D1 — Debit Operation Number (AUTO_DUPLICATE, debit only)**
- Applies only when `accountType === 'DEBIT_ACCOUNT'` AND `row.strOperationNumber` is not null/undefined.
- Condition:
  - `existing.strOperationNumber === row.strOperationNumber` AND
  - `existing.dateTransaction === row.dateTransaction`
- Result: `AUTO_DUPLICATE`, `checked = false`

**Rule A1 — Exact Match (AUTO_DUPLICATE, both account types)**
- Condition:
  - `existing.dateTransaction === row.dateTransaction` AND
  - `existing.strDescription === row.description` AND
  - `existing.strCurrency === row.currency` AND
  - `amountsMatch(existing.decAmount, row.amount)`
- Result: `AUTO_DUPLICATE`, `checked = false`

**Rule A2 — USD Floating Date (AUTO_DUPLICATE, USD only)**
- Applies only when `row.currency === 'USD'`.
- Condition:
  - `existing.strCurrency === 'USD'` AND
  - `existing.strDescription === row.description` AND
  - `amountsMatch(existing.decAmount, row.amount)` AND
  - `daysDiff(existing.dateTransaction, row.dateTransaction) <= 3`
- Result: `AUTO_DUPLICATE`, `checked = false`

**Rule P1 — Prefix + Amount + Date (POTENTIAL_DUPLICATE)**
- Condition:
  - `amountsMatch(existing.decAmount, row.amount)` AND
  - `lower(existing.strDescription[0:10]) === lower(row.description[0:10])` AND
  - `daysDiff <= 3`
- Result: `POTENTIAL_DUPLICATE`, `checked = true`

**Rule P2 — Amount + Date (POTENTIAL_DUPLICATE, opt-in)**
- Skipped entirely if `boolP2Enabled === false`.
- Condition:
  - `amountsMatch(existing.decAmount, row.amount)` AND
  - `daysDiff <= 3`
- Result: `POTENTIAL_DUPLICATE`, `checked = true`

**Rule P3 — Collection-Based (POTENTIAL_DUPLICATE)**
- For each `DuplicationCollection`:
  - If any collection string is contained in `row.description` (case-insensitive) AND any collection string is contained in `existing.strDescription` (case-insensitive):
  - Condition:
    - `amountsMatch(existing.decAmount, row.amount)` AND
    - `existing.strCurrency === row.currency` AND
    - `daysDiff <= 3`
  - Result: `POTENTIAL_DUPLICATE`, `checked = true`

**Default (no rule matched):**
- `flag = 'NONE'`, `checked = true`

### 2.6 Decision Tree (pseudocode)

```
function annotateRow(row, activeForAccount, collections, accountType, boolP2Enabled):

  // D1: debit only
  if accountType == DEBIT_ACCOUNT and row.strOperationNumber is not null:
    match = find activeForAccount where
      strOperationNumber == row.strOperationNumber
      and dateTransaction == row.dateTransaction
    if match: return AUTO_DUPLICATE(match)

  // A1: exact
  match = find activeForAccount where
    dateTransaction == row.dateTransaction
    and strDescription == row.description
    and strCurrency == row.currency
    and amountsMatch(decAmount, row.amount)
  if match: return AUTO_DUPLICATE(match)

  // A2: USD floating date
  if row.currency == 'USD':
    match = find activeForAccount where
      strCurrency == 'USD'
      and strDescription == row.description
      and amountsMatch(decAmount, row.amount)
      and daysDiff <= 3
    if match: return AUTO_DUPLICATE(match)

  // P1: prefix + amount + date
  desc10 = lower(row.description[0:10])
  match = find activeForAccount where
    amountsMatch(decAmount, row.amount)
    and lower(strDescription[0:10]) == desc10
    and daysDiff <= 3
  if match: return POTENTIAL_DUPLICATE(match)

  // P2: amount + date (opt-in)
  if boolP2Enabled:
    match = find activeForAccount where
      amountsMatch(decAmount, row.amount) and daysDiff <= 3
    if match: return POTENTIAL_DUPLICATE(match)

  // P3: collection-based
  for each collection in collections:
    if any collection.string in row.description (case-insensitive):
      match = find activeForAccount where
        (any collection.string in strDescription)
        and amountsMatch(decAmount, row.amount)
        and strCurrency == row.currency
        and daysDiff <= 3
      if match: return POTENTIAL_DUPLICATE(match)

  return NONE
```

### 2.7 daysDiff helper

```
daysDiff(dateA, dateB) = abs(Date(dateA).getTime() - Date(dateB).getTime()) / 86_400_000
```

Returns a decimal number of days. Comparisons use `<= 3` (3-day gap is included).

---

## 3 — Category Auto-Matching Algorithm

### 3.1 Purpose

Attempts to auto-assign a `subcategoryId` to each incoming row during import by matching the description against `CategoryRule` records.

### 3.2 Input

- `description: string` — transaction's `strDescription`
- `rules: CategoryRule[]` — all configured rules

### 3.3 Output

- `subcategoryId: string | undefined` — first matching rule's subcategoryId, or `undefined` if no match

### 3.4 Match types

| `strMatchType` | Condition |
|---|---|
| `STARTS_WITH` | `lower(description).startsWith(lower(rule.strMatchString))` |
| `CONTAINS`    | `lower(description).includes(lower(rule.strMatchString))` |
| `ENDS_WITH`   | `lower(description).endsWith(lower(rule.strMatchString))` |
| `EQUALS`      | `lower(description) === lower(rule.strMatchString)` |

### 3.5 Decision Tree

```
function matchCategory(description, rules):
  sorted = rules sorted by intPriority ASC
  desc = lower(description)
  for each rule in sorted:
    pattern = lower(rule.strMatchString)
    match = false
    switch rule.strMatchType:
      STARTS_WITH: match = desc.startsWith(pattern)
      CONTAINS:    match = desc.includes(pattern)
      ENDS_WITH:   match = desc.endsWith(pattern)
      EQUALS:      match = (desc == pattern)
    if match: return rule.subcategoryId
  return undefined
```

### 3.6 Priority uniqueness

Each rule must have a unique `intPriority` value. `CategoryService.saveRule()` rejects a save if another rule already holds the same `intPriority`. The UI provides a drag-to-reorder list (with up/down buttons as keyboard alternative) that keeps priorities contiguous and unique.

---

## 4 — Cycle Conciliation Algorithm (Credit Cards Only)

Debit accounts are NOT subject to conciliation.

### 4.1 Purpose

At the end of a billing cycle, the user provides their current bank-reported balance. The system computes what the balance should be based on recorded transactions, and classifies the difference as interest or unrecorded charges.

### 4.2 daysInMonth helper

```
daysInMonth(year, month):   // month is 0-indexed (JS convention)
  return new Date(year, month + 1, 0).getDate()
```

Used by both `buildCycleWindow` and `buildTargetDate` (§5.4).

### 4.3 Cycle Window Calculation

```
function buildCycleWindow(intClosingDay, todayDate):
  today = new Date(todayDate + 'T12:00:00')   // noon to avoid DST edge cases
  year  = today.getFullYear()
  month = today.getMonth()   // 0-indexed

  // Clamp closing day to end-of-month
  clampedDay = Math.min(intClosingDay, daysInMonth(year, month))
  closingDate = new Date(year, month, clampedDay)

  // cycleStart: day after clampedDay in the previous month
  prevMonth = month === 0 ? 11 : month - 1
  prevYear  = month === 0 ? year - 1 : year
  prevMonthClampedDay = Math.min(intClosingDay, daysInMonth(prevYear, prevMonth))
  cycleStart = new Date(prevYear, prevMonth, prevMonthClampedDay + 1)

  return {
    cycleStart:  formatDate(cycleStart),   // YYYY-MM-DD
    closingDate: formatDate(closingDate),  // YYYY-MM-DD
  }
```

Example: `intClosingDay = 31`, today = 2026-02-10 → `clampedDay = 28` → `closingDate = 2026-02-28`, `cycleStart = 2026-01-29`.

### 4.4 Balance Formula

```
openingBalance = previousCycleClose.decClosingBalance (or 0 if first cycle)

cycleMovementsSum = sum of decAmountPen for transactions where:
  accountId == card.id
  AND strStatus == 'ACTIVE'                    // confirmed charges only
  AND dateTransaction in [cycleStart, closingDate]

amountA = openingBalance + cycleMovementsSum   // expected closing balance

postCloseMovementsSum = sum of decAmountPen for transactions where:
  accountId == card.id
  AND strStatus != 'DELETED'                   // includes PENDING (expected payments)
  AND dateTransaction in (closingDate, todayDate]

currentBalanceNegated = -abs(enteredCurrentBalance)
amountB = currentBalanceNegated - postCloseMovementsSum   // implied closing balance

rawInterest = amountB - amountA
interestAmount = 0 if abs(rawInterest) < 0.01 else rawInterest
```

**Note:** `postCloseMovementsSum` includes PENDING transactions. This means expected payments the user has marked "pending" are factored into the balance estimate, giving a more accurate result.

### 4.5 Input

```typescript
interface ConciliationInput {
  cardId: string;
  intClosingDay: number;
  todayDate: string;                      // YYYY-MM-DD; from system clock
  currentBalance: number;                 // entered by user as positive; internally negated
  previousClosingBalance: number;         // from most recent CycleClose or 0
  nonDeletedTransactions: Transaction[];  // ALL non-DELETED transactions for this card
}
```

**System clock note:** `todayDate` is derived from the local system clock (`new Date().toISOString().slice(0, 10)`). No server time reference exists. Accuracy depends on the local clock being correct.

### 4.6 Decision Tree

```
function calculate(input):
  window = buildCycleWindow(input.intClosingDay, input.todayDate)
  openingBalance = input.previousClosingBalance

  cycleMovementsSum = sum(decAmountPen) for input.nonDeletedTransactions where
    accountId == input.cardId
    AND strStatus == 'ACTIVE'
    AND cycleStart <= dateTransaction <= closingDate

  amountA = openingBalance + cycleMovementsSum

  postCloseMovementsSum = sum(decAmountPen) for input.nonDeletedTransactions where
    accountId == input.cardId
    AND strStatus != 'DELETED'
    AND closingDate < dateTransaction <= todayDate

  currentBalanceNegated = -abs(input.currentBalance)
  amountB = currentBalanceNegated - postCloseMovementsSum

  rawInterest = amountB - amountA
  interestAmount = (abs(rawInterest) < 0.01) ? 0 : rawInterest

  return ConciliationResult { window, openingBalance, cycleMovementsSum,
    amountA, postCloseMovementsSum, currentBalanceNegated, amountB, interestAmount }
```

### 4.7 On Confirm

1. **Guard:** check for existing `CycleClose` with `cardId === card.id AND dateClosing === window.closingDate`. If found, prompt "A cycle close already exists for this period. Overwrite?" — on cancel, abort.
2. If `interestAmount !== 0`: create a Transaction:
   - `dateTransaction = closingDate`
   - `strDescription = 'INTERES'`
   - `strCurrency = 'PEN'`
   - `decAmount = interestAmount`
   - `strStatus = 'ACTIVE'`
3. Save `CycleClose` with `decClosingBalance = amountB`.
4. Save `CycleSnapshot` with `strType = 'CYCLE_CLOSE'`.
5. Show success toast.

**First-cycle note:** If `previousClosingBalance === 0` because no prior `CycleClose` exists, the UI shows an info note: *"First reconciliation for this card — opening balance assumed 0. Adjust manually if the card had an existing balance before this import."*

---

## 5 — Recurrent Transaction Matching Algorithm

### 5.1 Purpose

Tracks whether each "iteration" (monthly: YYYY-MM, yearly: YYYY) of a recurring charge or payment has been matched to an actual transaction.

### 5.2 Iteration Key

- MONTHLY: `iterationKey = dateTransaction.slice(0, 7)` → `'YYYY-MM'`
- YEARLY:  `iterationKey = dateTransaction.slice(0, 4)` → `'YYYY'`

### 5.3 Match Modes

**MANUAL mode:**
- User selects a transaction to link, or marks the iteration done without linking.
- `RecurrentTransactionMatch` created with `strMatchMode = 'MANUAL'`, `boolDone = true`.

**AUTOMATIC mode:**
- System scans ACTIVE transactions for the current iteration against configured criteria.
- At most ONE match per iteration key (first match wins).
- Required fields for AUTOMATIC mode (enforced by the form): `decApproxAmount`, `strMatchString`, `intDayRange`.

### 5.4 Automatic Matching Decision Tree

```
function findAutomaticMatch(recurrent, activeTransactions, todayDate):
  iterationKey = getCurrentIterationKey(recurrent.strFrequency, todayDate)
  targetDate   = buildTargetDate(recurrent, iterationKey)

  sign      = (recurrent.decApproxAmount < 0) ? -1 : +1
  absApprox = abs(recurrent.decApproxAmount ?? 0)
  range     = recurrent.decAmountRange ?? 0
  minAbs    = absApprox - range
  maxAbs    = absApprox + range

  for each transaction t in activeTransactions:
    if t.accountId != recurrent.accountId: continue
    if t.accountType != recurrent.accountType: continue
    if recurrent.strCurrency is defined and t.strCurrency != recurrent.strCurrency: continue

    actualSign = (t.decAmount < 0) ? -1 : +1
    if actualSign != sign: continue
    absActual = abs(t.decAmount)
    if absActual < minAbs OR absActual > maxAbs: continue

    if recurrent.strMatchString is defined:
      if NOT lower(t.strDescription).includes(lower(recurrent.strMatchString)): continue

    if targetDate is defined and recurrent.intDayRange is defined:
      if daysDiff(t.dateTransaction, targetDate) > recurrent.intDayRange: continue

    return t   // first match; stop

  return null
```

### 5.5 buildTargetDate

```
function buildTargetDate(recurrent, iterationKey):
  if recurrent.intApproxDay is null/undefined: return undefined

  if recurrent.strFrequency == 'MONTHLY':
    // iterationKey = 'YYYY-MM'
    year  = parseInt(iterationKey.slice(0, 4))
    month = parseInt(iterationKey.slice(5, 7)) - 1   // 0-indexed
    day   = Math.min(recurrent.intApproxDay, daysInMonth(year, month))
    return formatDate(year, month + 1, day)           // YYYY-MM-DD

  // YEARLY: iterationKey = 'YYYY'
  year  = parseInt(iterationKey)
  month = recurrent.intApproxMonth ?? 1              // 1-indexed
  day   = Math.min(recurrent.intApproxDay, daysInMonth(year, month - 1))
  return formatDate(year, month, day)                // YYYY-MM-DD
```

Example: `intApproxDay = 30`, February 2026 → clamps to `2026-02-28`.

### 5.6 Once-per-iteration enforcement

```
alreadyMatched = existingMatches.some(
  m => m.recurrentTransactionId == recurrent.id
    && m.strIterationKey == iterationKey
)
if alreadyMatched: skip
```

### 5.7 Dashboard display rules

For each `RecurrentTransaction`, the dashboard computes status for the **last 2 iteration keys**:

```
iterationKeys = [currentKey, previousKey]

for each key in iterationKeys:
  match     = existingMatches.find(m => m.recurrentTransactionId == r.id && m.strIterationKey == key)
  targetDate = buildTargetDate(r, key)

  if match?.boolDone:
    status = 'DONE'
  else if targetDate is undefined:
    status = 'NOT_CONFIGURED'   // MANUAL mode with no intApproxDay
  else if today < targetDate - r.intDayRange (with intDayRange defaulting to 0 for MANUAL):
    status = 'NOT_YET_DUE'
  else:
    status = 'PENDING'
```

**Status meanings:**

| Status | Badge color | Meaning |
|---|---|---|
| `DONE` | Green | Match record exists with `boolDone = true` |
| `PENDING` | Amber | Within or past the matching window; no match yet |
| `NOT_YET_DUE` | Gray | Today is before the matching window opens |
| `NOT_CONFIGURED` | Muted | MANUAL mode; no `intApproxDay` set |

Previous-iteration row: shown in muted style if DONE; shown in red if PENDING (missed iteration).

### 5.8 Match actions

**"Mark as done" (PENDING rows, current iteration only):**
```
saveMatch({
  recurrentTransactionId: r.id,
  strIterationKey: currentIterationKey,
  transactionId: undefined,
  boolDone: true, dateDone: todayDate, strMatchMode: 'MANUAL'
})
```

**"Link transaction" (PENDING rows):**
Opens a dialog listing ACTIVE transactions for the same `accountId`. User selects one:
```
saveMatch({
  recurrentTransactionId: r.id,
  strIterationKey: currentIterationKey,
  transactionId: selectedTransaction.id,
  boolDone: true, dateDone: todayDate, strMatchMode: 'MANUAL'
})
```

**"Unlink / Undo" (DONE rows):**
```
deleteMatch(match.id)
```
Removes the `RecurrentTransactionMatch` record. The iteration reverts to PENDING or NOT_YET_DUE.

**"Mark all PENDING as done" (bulk, current iteration):**
Iterates over all PENDING recurrents for `currentIterationKey` and creates one match record each with `transactionId = undefined`.

---

## 6 — Transfer Logic

Transfers link two transactions representing the same movement of money between accounts.

### 6.1 Types

- **Debit-to-Debit:** money moves between two savings accounts.
- **Debit-to-Credit payment:** user pays their credit card from a debit account.

### 6.2 Data model

Two `Transaction` records share a `transferGroupId` (UUID):
- Source (debit account): `decAmount < 0` (money leaves)
- Destination (credit card or debit account): `decAmount > 0` (money arrives)

### 6.3 Validation rules before creating a transfer

Before assigning a `transferGroupId`, enforce:
1. **Exactly 2 transactions per group.** A `transferGroupId` may not be assigned to a third transaction if two already share it.
2. **Different accounts.** Source and destination must have different `accountId` values.
3. **No existing group.** Neither transaction may already have a `transferGroupId`.

### 6.4 Decision Tree — Creating a Transfer

```
function createTransfer(fromAccountId, fromAccountType, toAccountId, toAccountType,
                        amount, amountPen, date, description):
  // Validation
  assert fromAccountId != toAccountId
  groupId = crypto.randomUUID()

  fromTxn = {
    accountId: fromAccountId, accountType: fromAccountType,
    dateTransaction: date, strDescription: description,
    decAmount: -abs(amount), decAmountPen: -abs(amountPen),
    strStatus: 'ACTIVE', transferGroupId: groupId,
  }
  toTxn = {
    accountId: toAccountId, accountType: toAccountType,
    dateTransaction: date, strDescription: description,
    decAmount: +abs(amount), decAmountPen: +abs(amountPen),
    strStatus: 'ACTIVE', transferGroupId: groupId,
  }

  save(fromTxn)
  save(toTxn)
```

### 6.5 Linking existing transactions

1. User selects a source transaction (debit account).
2. User selects a destination transaction (any account, different from source's account).
3. System validates: different accounts; neither has an existing `transferGroupId`.
4. System generates a `transferGroupId` and updates both records.

---

## 7 — Transaction Status Transitions

### 7.1 Status definitions

| Status | Meaning |
|---|---|
| `ACTIVE`  | Confirmed transaction; included in all balance calculations |
| `PENDING` | Expected transaction; included in balance estimates; visually distinct |
| `DELETED` | Soft-deleted; excluded from calculations and displays |

### 7.2 Allowed transitions

```
ACTIVE  → PENDING   (user marks "make pending" via context menu)
ACTIVE  → DELETED   (user soft-deletes)
PENDING → ACTIVE    (user confirms the transaction is finalized)
PENDING → DELETED   (user cancels the expected transaction)
DELETED → ACTIVE    (user restores — accessible via admin/debug view)
```

### 7.3 PENDING during import

In Step 2 (Review), the context menu per incoming row includes "Mark as Pending". If selected, `annotatedRow.pendingFlag = true`. In Step 3, the saved transaction gets `strStatus = 'PENDING'`.

---

## 8 — Import Wizard Decision Flow

Three steps: **Upload → Review → Finalize**. No localStorage writes occur until Step 3 ("Save & Finish"). Steps 1 and 2 are purely in-memory.

### 8.1 Step 1 — Upload

```
Pre-parse validation (before arrayBuffer()):
  1. if NOT file.name.endsWith('.xlsx'): show error "Only .xlsx files are supported"; abort
  2. if file.size > 10 MB: show error "File is too large (max 10 MB)"; abort

Parse:
  result = ExcelParserService.parseFile(file, usdExchangeRate)
    → { rows: RawImportRow[], hasMultipleSheets, hasUsdRows }

  if hasMultipleSheets: show info banner "Multiple sheets detected — using the first sheet only."
  if rows.length == 0: show error "No valid rows found — check file format"; disable "Next"

Exchange rate:
  usdExchangeRate field always shown (default 1.00)
  if hasUsdRows: field is required and must be > 0; validate before allowing "Next"
  if NOT hasUsdRows: field is optional; any value accepted; 1.00 used if blank

On "Next" (all validations passed):
  1. Show MatProgressSpinner during parseFile()
  2. DuplicationLogicService.annotate(rows, existingTxns, collections, accountId, accountType, boolP2Enabled)
  3. CategoryMatchingService.match(description, rules) for each row → pre-populate subcategoryId
  4. contextTransactions = ACTIVE transactions for accountId where dateTransaction in
       [min(rows.dateTransaction) - 5 days, min(rows.dateTransaction) - 1 day]
  5. ImportWizardStateService.patch({ accountId, accountType, annotatedRows, contextTransactions,
       currentBalance, usdExchangeRate, pendingDeletions: [] })
  6. Navigate to Step 2

No localStorage writes in this step.
```

### 8.2 Step 2 — Review

```
CanDeactivate guard:
  if annotatedRows.length > 0 AND user navigates away (sidenav, browser back, or any link):
    show MatDialog confirm "You have an import in progress. Leave? Your progress will be lost."

Display:
  - Incoming rows grouped by dateTransaction DESC
  - AUTO_DUPLICATE rows: unchecked, disabled, grayed out
  - If ALL rows are AUTO_DUPLICATE: show info banner "All N rows were detected as duplicates
    and will be skipped."
  - POTENTIAL_DUPLICATE rows: highlighted; matching transaction shown as sub-row
  - P2-flagged rows (boolP2Enabled): badge "P2" with tooltip "Same amount ±3 days (opt-in rule)"
  - Context menu per row: "Add additional info" | "Mark as Pending"
  - Context transactions (5-day window): shown below with trash icon

Deletion intent pattern:
  Clicking the trash icon on a context transaction does NOT write to localStorage.
  Instead: ImportWizardStateService.patch({ pendingDeletions: [...current, txnId] })
  The transaction is shown as "struck through / grayed" in the UI immediately.
  Clicking again (un-delete): removes the id from pendingDeletions.

On "← Back": reset ImportWizardState; navigate to Step 1 (re-parse required)

On "Next →":
  1. Flush all row changes (subcategoryId, note, pendingFlag) from DOM to ImportWizardStateService
  2. Apply pending deletions: for each id in pendingDeletions: transactionService.softDelete(id)
     [only localStorage write in Step 2]
  3. Navigate to Step 3

No ImportBatch or Transaction records created in this step.
```

### 8.3 Step 3 — Finalize

```
Display:
  Read-only summary: account name, N transactions to import, M auto-duplicates skipped,
  exchange rate applied, P pending transactions

On "Save & Finish":
  1. Open MatDialog confirm:
     "Import N transactions into [Account Name]? This cannot be undone."
     User cancels → abort; no writes.

  2. try {
       a. Create ImportBatch:
            importBatchService.save({
              accountId, accountType,
              dateImport: todayDate,
              decUsdExchangeRate: usdExchangeRate,
              decBalanceAtImport: accountType == 'CREDIT_CARD'
                ? -abs(currentBalance)
                : abs(currentBalance),
            })

       b. Map and save checked transactions:
            checkedRows = annotatedRows.filter(r => r.checked)
            transactions = checkedRows.map(row => ({
              accountId, accountType, importBatchId: batch.id,
              dateTransaction:    row.raw.dateTransaction,
              strDescription:     row.raw.description,
              strCurrency:        row.raw.currency,
              decAmount:          row.raw.amount,
              decAmountPen:       row.raw.amountPen,
              subcategoryId:      row.subcategoryId,
              strNotes:           row.note,
              strOperationNumber: row.raw.strOperationNumber,
              strStatus:          row.pendingFlag ? 'PENDING' : 'ACTIVE',
            }))
            transactionService.saveMany(transactions)

       c. Run automatic recurrent matching:
            allActive = transactionService.getActive()
            newMatches = recurrentMatchingService.findAutomaticMatches(
              recurrents, existingMatches, allActive, todayDate)
            // Partial match failure is accepted: if the tab closes mid-loop,
            // already-written matches are preserved; unwritten are simply skipped
            // on the next import (alreadyMatched guard prevents double-matching).
            for each result in newMatches:
              recurrentTransactionService.saveMatch({ ... boolDone: true, strMatchMode: 'AUTOMATIC' })

       d. Check storage; warn if > 4 MB

       e. Reset ImportWizardState

       f. Show success toast "Import complete — N transactions saved."

       g. Navigate:
            if accountType == 'CREDIT_CARD': navigate to ROUTES.CONCILIATION
            if accountType == 'DEBIT_ACCOUNT': navigate to ROUTES.TRANSACTIONS

     } catch (StorageWriteError) {
       Show toast "Save failed — storage quota exceeded. No data was written."
       Attempt rollback of any partially written data if detectable.
     }
```

**localStorage writes on Step 3 confirm:**

| Key | Action |
|---|---|
| `pfmg_import_batches` | One new ImportBatch |
| `pfmg_transactions` | N new Transaction records |
| `pfmg_recurrent_matches` | 0–N new match records |

**Note:** Account balance is NOT updated on the account record. Balance is derived from the ImportBatch on demand (see §11).

---

## 9 — Excel Parsing Rules

Column header constants are defined at the top of `ExcelParserService`. All fields refer to `RawImportRow`.

### 9.1 Credit card Excel columns

| Constant | Header value | `RawImportRow` field | Notes |
|---|---|---|---|
| `COL_FECHA` | `'Fecha'` | `dateTransaction` | SheetJS `cellDates:true` returns a JS Date; formatted with local components (see §9.3) |
| `COL_DESCRIPCION` | `'Descripcion'` | `description` | String; trimmed |
| `COL_MONEDA` | `'Moneda'` | `currency` | `'S/'` → `'PEN'`; `'$'` → `'USD'` |
| `COL_MONTO` | `'Monto'` | `amount` | Number; see `parseAmount()` |
| *(computed)* | — | `amountPen` | `currency === 'PEN' ? amount : amount × usdExchangeRate`; computed at parse time |

### 9.2 Debit account additional columns

| Constant | Header value | `RawImportRow` field | Notes |
|---|---|---|---|
| `COL_OPERACION` | `'N° Operacion'` | `strOperationNumber` | Primary; used for D1 |
| `COL_OPERACION_ALT` | `'Operacion'` | `strOperationNumber` | Fallback if primary absent |

If both columns are absent, `strOperationNumber = undefined`; row falls through to A1/P1/P2/P3.

### 9.3 parseDate — timezone-safe

```
function parseDate(value):
  if value instanceof Date:
    // Use local date components to avoid UTC shift (e.g., UTC-5 offset)
    y = value.getFullYear()
    m = String(value.getMonth() + 1).padStart(2, '0')
    d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  // Text fallback (all bank exports deliver text cells, cellDates may not apply)
  str = String(value).trim()
  // Try DD/MM/YYYY (common Peruvian format)
  match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if match: return `${match[3]}-${match[2]}-${match[1]}`
  // Try YYYY-MM-DD passthrough
  if /^\d{4}-\d{2}-\d{2}$/.test(str): return str
  // Unknown format: return as-is; row will fail downstream validation
  return str
```

### 9.4 parseAmount helper

```
function parseAmount(raw):
  if raw == null: return 0
  cleaned = String(raw).replace(/,/g, '')
  n = Number(cleaned)
  return isNaN(n) ? 0 : n
```

A zero amount will pass the row filter and be stored as 0. Rows with amount = 0 are valid (some banks include informational rows at zero).

### 9.5 parseFile return type

```typescript
interface ParseFileResult {
  rows: RawImportRow[];
  hasMultipleSheets: boolean;
  hasUsdRows: boolean;
}
```

`hasUsdRows = rows.some(r => r.currency === 'USD')`.

### 9.6 Row filtering

Rows where `Fecha`, `Descripcion`, `Moneda`, or `Monto` are null/empty after parsing are silently discarded before annotation.

---

## 10 — Monthly Dashboard Calculation

### 10.1 Purpose

Compute total income, total expenses, and a subcategory breakdown for a given month (`'YYYY-MM'`). Used by `MonthlyDashboardComponent`.

### 10.2 Transaction set

- Include: ACTIVE and PENDING transactions.
- Exclude: DELETED transactions.
- Month filter: `transaction.dateTransaction.startsWith(month)` (string prefix; no date parsing needed).
- All accounts included (credit cards and debit accounts).

### 10.3 Income / Expense classification

| Condition | Classification |
|---|---|
| `decAmountPen > 0` | Income |
| `decAmountPen < 0` | Expense |
| `decAmountPen === 0` | Excluded from both totals |

### 10.4 Decision Tree

```
function computeMonthly(month, transactions, subcategories, categories):
  inMonth = transactions where strStatus != 'DELETED' and dateTransaction startsWith month

  totalIncome   = sum(decAmountPen) where decAmountPen > 0
  totalExpenses = sum(decAmountPen) where decAmountPen < 0
  netAmount     = totalIncome + totalExpenses

  // PENDING footnote
  pendingInMonth  = inMonth where strStatus == 'PENDING'
  pendingCount    = pendingInMonth.length
  pendingTotal    = sum(pendingInMonth.decAmountPen)

  // Subcategory grouping
  subcategoryMap = {}
  for t in inMonth where subcategoryId is not null:
    subcategoryMap[subcategoryId] += t.decAmountPen

  bySubcategory = for each (id, total) in subcategoryMap:
    sub = find subcategory by id
    cat = find category by sub.categoryId
    yield { subcategoryId: id, subcategoryName: sub.strName,
            categoryName: cat.strName, total }
  sorted bySubcategory by abs(total) DESC, then subcategoryName ASC

  // Split uncategorized
  uncatTxns = inMonth where subcategoryId is null
  uncategorizedIncome   = sum(decAmountPen) for uncatTxns where decAmountPen > 0
  uncategorizedExpenses = sum(decAmountPen) for uncatTxns where decAmountPen < 0

  return {
    month, totalIncome, totalExpenses, netAmount,
    bySubcategory,
    uncategorizedIncome, uncategorizedExpenses,
    pendingCount, pendingTotal,
  }
```

### 10.5 Transfer handling in display

The component includes a "Show / Hide transfers" toggle. When **hide transfers** is active, rows where `transferGroupId != null` are filtered out from `inMonth` before all computations. This prevents inter-account transfers from inflating both income and expense totals.

### 10.6 Display conventions

- `totalExpenses` is negative; UI displays `abs(totalExpenses)` in red.
- `netAmount`: red if negative (net expense month), green if positive.
- `bySubcategory`: sorted by `abs(total)` DESC, secondary sort by `subcategoryName` ASC (stable).
- Uncategorized income and uncategorized expenses shown as two separate rows at the bottom.
- If `pendingCount > 0`: footnote below summary "* Includes N pending transactions (S/ X.XX)".
- "Next →" navigation disabled when `selectedMonth >= currentMonth` (no future navigation).

---

## 11 — Balance Computation

`decCurrentBalance` is **not stored** on `CreditCard` or `DebitAccount` models. Balance is always derived on the fly.

### 11.1 Algorithm

```
function computeCurrentBalance(accountId, importBatches):
  relevant = importBatches.filter(b => b.accountId === accountId)
  if relevant.length == 0: return 0
  latest = relevant.sort by dateImport DESC [0]
  return latest.decBalanceAtImport
```

This returns the user-reported balance at the time of the most recent import for that account.

### 11.2 Display

The balance label in the Cycle Dashboard and any account detail view reads:

> **Balance:** S/ −1 250.00
> *(as of last import — 2026-05-10)*

The date shown is `latest.dateImport`. This makes the staleness explicit.

### 11.3 When the balance is updated

- Every time the user completes Step 3 of the import wizard, a new `ImportBatch` is saved with `decBalanceAtImport`. The computed balance automatically reflects this on next render.
- There is no separate "update balance" action. The balance is always as of the most recent import.
