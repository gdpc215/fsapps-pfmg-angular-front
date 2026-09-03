# Business Logic Reference — fsapps-pfmg

**Version:** 1.2
**Date:** 2026-05-14
**Project:** fsapps-pfmg
**Purpose:** Authoritative specification of all algorithms, decision trees, and rule systems. Whenever design documents (DESIGN.md, DESIGN_LOCAL.md) describe logic at a high level, this document provides the precise decision trees and pseudocode.

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

---

## 1 — Transaction Amounts and Sign Convention

**Rule:** All amounts follow the bank statement sign convention.

- Negative amount (`decAmount < 0`) = charge or outgoing payment (money leaving the account)
- Positive amount (`decAmount > 0`) = payment, refund, or incoming transfer (money returning to or entering the account)
- `decAmountPen` is always in PEN. For USD transactions, `decAmountPen = decAmount × usdExchangeRate` at import time; never re-converted later.
- Credit card balances are stored as negative when owed (e.g., "you owe 1500 PEN" is stored as `-1500`).
- During import, the user inputs the current balance as a positive number; the system negates it internally: `decBalanceAtImport = -Math.abs(enteredBalance)`.
- Debit account balances are stored as positive (savings balance).

---

## 2 — Duplication Detection Algorithm

This algorithm runs during the import wizard Step 1 → Step 2 transition. It is applied to each incoming row against all ACTIVE transactions for the same account.

### 2.1 Input

- `incoming: RawImportRow[]` — rows parsed from the Excel file
- `existing: Transaction[]` — all ACTIVE transactions for the account being imported
- `collections: DuplicationCollection[]` — named string groups for cross-description matching
- `accountType: AccountType` — `'CREDIT_CARD'` or `'DEBIT_ACCOUNT'`

### 2.2 Output

Each incoming row is annotated with:

- `flag: 'NONE' | 'AUTO_DUPLICATE' | 'POTENTIAL_DUPLICATE'`
- `matchingTransaction?: Transaction` — the existing transaction that triggered the flag
- `checked: boolean` — `false` for AUTO_DUPLICATE (unchecked by default), `true` for all others

### 2.3 Rules (evaluated in order; first match wins)

**Rule D1 — Debit Operation Number (AUTO_DUPLICATE, debit only)**
- Applies only when `accountType === 'DEBIT_ACCOUNT'` and the incoming row has a `strOperationNumber`.
- Condition:
  - `existing.strOperationNumber === incoming.strOperationNumber` AND
  - `existing.dateTransaction === incoming.dateTransaction`
- Result: `AUTO_DUPLICATE`, `checked = false`

**Rule A1 — Exact Match (AUTO_DUPLICATE, both account types)**
- Condition:
  - `existing.dateTransaction === incoming.dateTransaction` AND
  - `existing.strDescription === incoming.description` AND
  - `existing.strCurrency === incoming.currency` AND
  - `existing.decAmount === incoming.amount`
- Result: `AUTO_DUPLICATE`, `checked = false`

**Rule A2 — USD Floating Date (AUTO_DUPLICATE, USD only)**
- Applies only when `incoming.currency === 'USD'`.
- Condition:
  - `existing.strCurrency === 'USD'` AND
  - `existing.strDescription === incoming.description` AND
  - `existing.decAmount === incoming.amount` AND
  - `|daysDiff(existing.dateTransaction, incoming.dateTransaction)| <= 3`
- Result: `AUTO_DUPLICATE`, `checked = false`

**Rule P1 — Prefix + Amount + Date (POTENTIAL_DUPLICATE)**
- Condition:
  - `existing.decAmount === incoming.amount` AND
  - `lower(existing.strDescription[0:10]) === lower(incoming.description[0:10])` AND
  - `|daysDiff| <= 3`
- Result: `POTENTIAL_DUPLICATE`, `checked = true`, `matchingTransaction = existing`

**Rule P2 — Amount + Date (POTENTIAL_DUPLICATE)**
- Condition:
  - `existing.decAmount === incoming.amount` AND
  - `|daysDiff| <= 3`
- Result: `POTENTIAL_DUPLICATE`, `checked = true`, `matchingTransaction = existing`

**Rule P3 — Collection-Based (POTENTIAL_DUPLICATE)**
- For each `DuplicationCollection`:
  - If any collection string is contained in `incoming.description` (case-insensitive)
  - AND an existing transaction's `strDescription` also contains any collection string (case-insensitive)
  - Condition:
    - `existing.decAmount === incoming.amount` AND
    - `existing.strCurrency === incoming.currency` AND
    - `|daysDiff| <= 3`
  - Result: `POTENTIAL_DUPLICATE`, `checked = true`, `matchingTransaction = existing`

**Default (no rule matched):**
- `flag = 'NONE'`, `checked = true`

### 2.4 Decision Tree (pseudocode)

```
function annotateRow(row, existing, collections, accountType):
  if accountType == DEBIT_ACCOUNT and row.strOperationNumber is not null:
    match = find existing where strOperationNumber == row.strOperationNumber
                              and dateTransaction == row.dateTransaction
    if match: return AUTO_DUPLICATE(match)

  match = find existing where dateTransaction == row.dateTransaction
                            and strDescription == row.description
                            and strCurrency == row.currency
                            and decAmount == row.amount
  if match: return AUTO_DUPLICATE(match)

  if row.currency == 'USD':
    match = find existing where strCurrency == 'USD'
                              and strDescription == row.description
                              and decAmount == row.amount
                              and |daysDiff| <= 3
    if match: return AUTO_DUPLICATE(match)

  desc10 = lower(row.description[0:10])
  match = find existing where decAmount == row.amount
                            and lower(strDescription[0:10]) == desc10
                            and |daysDiff| <= 3
  if match: return POTENTIAL_DUPLICATE(match)

  match = find existing where decAmount == row.amount and |daysDiff| <= 3
  if match: return POTENTIAL_DUPLICATE(match)

  for each collection in collections:
    if any collection.string is contained in row.description (case-insensitive):
      match = find existing where (any collection.string in strDescription)
                                and decAmount == row.amount
                                and strCurrency == row.currency
                                and |daysDiff| <= 3
      if match: return POTENTIAL_DUPLICATE(match)

  return NONE
```

### 2.5 daysDiff helper

```
daysDiff(dateA, dateB) = abs(Date(dateA) - Date(dateB)) / 86_400_000
```

Returns a decimal number of days. Comparisons use `<= 3` (not `< 3`), so a 3-day gap is included.

---

## 3 — Category Auto-Matching Algorithm

### 3.1 Purpose

When an incoming transaction row is being processed during import, the system attempts to auto-assign a `subcategoryId` by matching the transaction description against configured `CategoryRule` records.

### 3.2 Input

- `description: string` — transaction's `strDescription`
- `rules: CategoryRule[]` — all configured rules (sorted by `intPriority` ASC before matching)

### 3.3 Output

- `subcategoryId: string | undefined` — first matching rule's subcategoryId, or `undefined` if no match

### 3.4 Match types

| `strMatchType` | Condition |
|---|---|
| `STARTS_WITH` | `lower(description).startsWith(lower(rule.strMatchString))` |
| `CONTAINS` | `lower(description).includes(lower(rule.strMatchString))` |
| `ENDS_WITH` | `lower(description).endsWith(lower(rule.strMatchString))` |
| `EQUALS` | `lower(description) === lower(rule.strMatchString)` |

### 3.5 Decision Tree

```
function matchCategory(description, rules):
  sorted = rules sorted by intPriority ASC (lower number = higher priority)
  desc = lower(description)
  for each rule in sorted:
    pattern = lower(rule.strMatchString)
    match = false
    switch rule.strMatchType:
      STARTS_WITH: match = desc.startsWith(pattern)
      CONTAINS:    match = desc.includes(pattern)
      ENDS_WITH:   match = desc.endsWith(pattern)
      EQUALS:      match = (desc == pattern)
    if match:
      return rule.subcategoryId     // <- first match wins; stop here
  return undefined                  // no rule matched
```

### 3.6 Priority tiebreaker

Each rule must have a unique `intPriority` value within the full rule set. The UI enforces this via a bulk drag-to-reorder interface. Rules with the same priority are considered a configuration error; the system applies them in insertion order as a fallback.

---

## 4 — Cycle Conciliation Algorithm (Credit Cards Only)

Debit accounts are NOT subject to conciliation. This algorithm is only for credit cards.

### 4.1 Purpose

At the end of each billing cycle (or at any mid-cycle point), the user provides their current bank-reported balance. The system computes what the balance *should* be based on recorded transactions, and the difference is classified as interest or unrecorded charges.

### 4.2 Cycle Window Calculation

```
function buildCycleWindow(intClosingDay, todayDate):
  today = parseDate(todayDate)
  closingDate = date(today.year, today.month, intClosingDay)
  prevMonth = today.month - 1 (wrap: December if January)
  prevYear  = today.year - 1 if today.month == 1 else today.year
  cycleStart = date(prevYear, prevMonth, intClosingDay + 1)
  return { cycleStart, closingDate }
```

Note: `closingDate` is in the *current* month. `cycleStart` is D+1 of the *previous* month. Example: closing day = 15, today = 2026-05-10 → cycleStart = 2026-04-16, closingDate = 2026-05-15.

### 4.3 Balance Formula

```
openingBalance = previousCycleClose.decClosingBalance (or 0 if first cycle)

cycleMovementsSum = sum of decAmountPen for all ACTIVE transactions
                    where accountId == card.id
                    and dateTransaction in [cycleStart, closingDate]

amountA = openingBalance + cycleMovementsSum
          (what the balance should be at closing based on recorded movements)

postCloseMovementsSum = sum of decAmountPen for all ACTIVE transactions
                        where accountId == card.id
                        and dateTransaction in (closingDate, todayDate]

currentBalanceNegated = -abs(enteredCurrentBalance)
amountB = currentBalanceNegated - postCloseMovementsSum
          (implied closing balance: strip out post-close movements from today's balance)

rawInterest = amountB - amountA

interestAmount = 0 if abs(rawInterest) < 0.01 else rawInterest
                 (0.01 PEN tolerance for floating-point rounding)
```

### 4.4 Decision Tree

```
function calculate(input):
  window = buildCycleWindow(card.intClosingDay, todayDate)
  openingBalance = mostRecentCycleClose?.decClosingBalance ?? 0

  cycleMovements = filter transactions:
    accountId == card.id AND status == ACTIVE
    AND cycleStart <= dateTransaction <= closingDate
  cycleMovementsSum = sum(decAmountPen)

  amountA = openingBalance + cycleMovementsSum

  postCloseMovements = filter transactions:
    accountId == card.id AND status == ACTIVE
    AND closingDate < dateTransaction <= todayDate
  postCloseMovementsSum = sum(decAmountPen)

  currentBalanceNegated = -abs(enteredBalance)
  amountB = currentBalanceNegated - postCloseMovementsSum

  rawInterest = amountB - amountA
  interestAmount = (abs(rawInterest) < 0.01) ? 0 : rawInterest

  return ConciliationResult { window, openingBalance, cycleMovementsSum,
    amountA, postCloseMovementsSum, currentBalanceNegated, amountB, interestAmount }
```

### 4.5 On Confirm

1. If `interestAmount !== 0`: create a Transaction with:
   - `dateTransaction = closingDate`
   - `strDescription = 'INTERES'`
   - `strCurrency = 'PEN'`
   - `decAmount = interestAmount` (negative = interest charge; positive = credit/correction)
   - `strStatus = 'ACTIVE'`
2. Save a `CycleClose` record with `decClosingBalance = amountB`.
3. Save a `CycleSnapshot` record with `strType = 'CYCLE_CLOSE'`.
4. Update `CreditCard.decCurrentBalance = amountB`.

---

## 5 — Recurrent Transaction Matching Algorithm

### 5.1 Purpose

Recurrent transactions represent known periodic charges or payments (e.g., monthly subscription, yearly insurance). The system tracks whether each "iteration" (monthly: YYYY-MM, yearly: YYYY) has been matched to an actual transaction.

### 5.2 Iteration Key

- MONTHLY: `iterationKey = dateTransaction.slice(0, 7)` → `'YYYY-MM'`
- YEARLY: `iterationKey = dateTransaction.slice(0, 4)` → `'YYYY'`

The iteration key of "today" is computed the same way from `todayDate`.

### 5.3 Match Modes

**MANUAL mode:**
- User browses the transaction list and explicitly selects a transaction to link to the recurrent entry.
- Creates a `RecurrentTransactionMatch` with `strMatchMode = 'MANUAL'`, `transactionId = selected.id`, `boolDone = true`.
- Alternatively, user marks it done without linking a transaction (e.g., cash payment): creates `RecurrentTransactionMatch` with `boolDone = true`, `transactionId = undefined`.

**AUTOMATIC mode:**
- System scans ACTIVE transactions for the current iteration and checks against the configured criteria.
- At most ONE match per iteration key (first match wins; stop searching after a match is found).

### 5.4 Automatic Matching Decision Tree

```
function findAutomaticMatch(recurrent, activeTransactions, todayDate):
  iterationKey = getCurrentIterationKey(recurrent.strFrequency, todayDate)

  targetDate = buildTargetDate(recurrent, iterationKey)
  // MONTHLY: YYYY-MM-{intApproxDay}
  // YEARLY:  YYYY-{intApproxMonth}-{intApproxDay}

  sign = (recurrent.decApproxAmount < 0) ? -1 : +1
  absApprox = abs(recurrent.decApproxAmount)
  minAbs = absApprox - recurrent.decAmountRange
  maxAbs = absApprox + recurrent.decAmountRange

  for each transaction t in activeTransactions:
    // Account filter
    if t.accountId != recurrent.accountId: continue
    if t.accountType != recurrent.accountType: continue

    // Currency filter (if specified)
    if recurrent.strCurrency is defined and t.strCurrency != recurrent.strCurrency: continue

    // Amount range check (sign must match)
    actualSign = (t.decAmount < 0) ? -1 : +1
    if actualSign != sign: continue
    if abs(t.decAmount) < minAbs OR abs(t.decAmount) > maxAbs: continue

    // Description check (CONTAINS, case-insensitive)
    if recurrent.strMatchString is defined:
      if NOT lower(t.strDescription).includes(lower(recurrent.strMatchString)): continue

    // Date range check
    if targetDate is defined and recurrent.intDayRange is defined:
      if daysDiff(t.dateTransaction, targetDate) > recurrent.intDayRange: continue

    return t  // <- first match; stop here

  return null  // no match found this iteration
```

### 5.5 Once-per-iteration enforcement

Before running the automatic scan, always check:

```
alreadyMatched = existingMatches.some(
  m => m.recurrentTransactionId == recurrent.id
    && m.strIterationKey == iterationKey
)
if alreadyMatched: skip (do not scan, do not create another match)
```

### 5.6 Dashboard display rules

For each RecurrentTransaction, the dashboard shows:

- Status for current iteration: DONE (green) / PENDING (amber) / NOT_YET_DUE (gray)
- **NOT_YET_DUE:** today's date is before `targetDate - intDayRange`
- **PENDING:** within or past the matching window but no match found yet
- **DONE:** `RecurrentTransactionMatch.boolDone === true` for the current iteration

---

## 6 — Transfer Logic

Transfers link two transactions that represent the same movement of money between accounts.

### 6.1 Types of transfers

- **Debit-to-Debit transfer:** money moves from one savings account to another.
- **Debit-to-Credit payment:** the user pays their credit card balance using a debit account.

### 6.2 Data model

Transfers are modeled as two `Transaction` records that share a `transferGroupId` (a UUID generated once and assigned to both):

- Source transaction (debit account): `decAmount < 0` (money leaves)
- Destination transaction (credit card or debit account): `decAmount > 0` (money arrives)

### 6.3 Decision Tree — Creating a Transfer

```
function createTransfer(fromAccountId, fromAccountType, toAccountId, toAccountType,
                        amount, amountPen, date, description):
  groupId = crypto.randomUUID()

  fromTransaction = {
    accountId: fromAccountId,
    accountType: fromAccountType,
    dateTransaction: date,
    strDescription: description,
    decAmount: -abs(amount),       // negative: leaving source
    decAmountPen: -abs(amountPen),
    strStatus: ACTIVE,
    transferGroupId: groupId,
    ...
  }

  toTransaction = {
    accountId: toAccountId,
    accountType: toAccountType,
    dateTransaction: date,
    strDescription: description,
    decAmount: +abs(amount),       // positive: arriving at destination
    decAmountPen: +abs(amountPen),
    strStatus: ACTIVE,
    transferGroupId: groupId,
    ...
  }

  save(fromTransaction)
  save(toTransaction)
```

### 6.4 UI: linking existing transactions as a transfer

The user may also link two already-imported transactions as a transfer pair (e.g., the bank statement shows them separately):

1. User selects the source transaction (from a debit account list).
2. User selects the destination transaction (from any account list).
3. System generates a `transferGroupId` and updates both transactions.

---

## 7 — Transaction Status Transitions

### 7.1 Status definitions

| Status | Meaning |
|---|---|
| `ACTIVE` | Normal, confirmed transaction included in all balance calculations |
| `PENDING` | Known or expected transaction; included in balance estimates; visually distinct |
| `DELETED` | Soft-deleted; excluded from all calculations and displays by default |

### 7.2 Allowed transitions

```
ACTIVE   -> PENDING   (user marks as "mark as pending" via context menu)
ACTIVE   -> DELETED   (user deletes via soft-delete action)
PENDING  -> ACTIVE    (user confirms the transaction is finalized)
PENDING  -> DELETED   (user cancels/removes the expected transaction)
DELETED  -> ACTIVE    (user restores a soft-deleted transaction — must be accessible via admin/debug view)
```

Transitions not listed above are not supported by the UI (e.g., `DELETED → PENDING` directly).

### 7.3 PENDING during import wizard

During the import wizard Step 2 (Review), the context menu on each incoming transaction row includes "Mark as Pending". If selected:

- That row's `annotatedRow.pendingFlag = true` (stored in-memory)
- In Step 3 (Finalize), on "Save & Finish", the transaction is saved with `strStatus = 'PENDING'` instead of `'ACTIVE'`

---

## 8 — Import Wizard Decision Flow

The import wizard has **three steps**: Upload → Review → Finalize. No localStorage writes occur until Step 3. Steps 1 and 2 are purely in-memory.

### 8.1 Step 1 — Upload

```
User inputs:
  - accountId + accountType (selected from credit cards + debit accounts list)
  - xlsx file
  - currentBalance (positive number)
  - usdExchangeRate (always required, even for PEN-only files; default 1.0 for PEN)

On "Next":
  1. Parse xlsx -> RawImportRow[] via ExcelParserService.parseFile(file, usdExchangeRate)
       Each row includes amountPen, computed inline by the parser:
         amountPen = (currency == 'PEN') ? amount : amount * usdExchangeRate
  2. Call DuplicationLogicService.annotate(rows, existingActive, collections, accountType)
  3. Call CategoryMatchingService.match(description, rules) for each row
       -> pre-populate subcategoryId
  4. Find earliestDate = min(rows[].dateTransaction)
     contextTransactions = ACTIVE transactions for accountId where dateTransaction in
       [earliestDate - 5 days, earliestDate - 1 day]
  5. Store all in ImportWizardState, navigate to Step 2
     No localStorage writes in this step.
```

### 8.2 Step 2 — Review

```
Display:
  - Each incoming row: checkbox, description, amount, currency, subcategory selector,
    "..." context menu
  - AUTO_DUPLICATE rows: unchecked (disabled), grayed out
  - POTENTIAL_DUPLICATE rows: highlighted; matching existing transaction shown as sub-row
  - Context menu options per row:
      - "Add additional info" -> opens free-text note dialog
      - "Mark as Pending"    -> sets pendingFlag = true on the row

  - Below incoming rows: context transactions (from 5 days before)
      - Each with trash icon -> softDelete(transaction.id)  [only localStorage write in Step 2]

On "Next →":
  1. Persist any subcategory / note / pendingFlag changes to ImportWizardState
  2. Navigate to Step 3
     No ImportBatch or Transaction records are created.
```

### 8.3 Step 3 — Finalize

```
Display:
  - Read-only summary: account name, transactions-to-import count, auto-duplicates skipped,
    exchange rate applied, pending transactions count

On "Save & Finish":
  1. Create ImportBatch:
       { accountId, accountType, dateImport: today, decUsdExchangeRate,
         decBalanceAtImport: (accountType == CREDIT_CARD) ? -abs(currentBalance) : currentBalance }

  2. Filter rows to checked == true

  3. For each checked row, build Transaction:
       { accountId, accountType, importBatchId: batch.id,
         dateTransaction:    row.dateTransaction,
         strDescription:     row.description,
         strCurrency:        row.currency,
         decAmount:          row.amount,
         decAmountPen:       row.amountPen,       // pre-computed by parser; no re-conversion
         subcategoryId:      row.subcategoryId,
         strNotes:           row.note,
         strOperationNumber: row.strOperationNumber,
         strStatus:          row.pendingFlag ? 'PENDING' : 'ACTIVE' }

  4. transactionService.saveMany(allCheckedTransactions) — single localStorage write

  5. Update account.decCurrentBalance:
       credit card: -abs(currentBalance)
       debit account: abs(currentBalance)

  6. Run automatic recurrent matching against the current cycle:
       allActive = transactionService.getActive()   // includes just-saved rows
       newMatches = recurrentMatchingService.findAutomaticMatches(
           recurrents, existingMatches, allActive, todayDate)
       for each result in newMatches:
           recurrentTransactionService.saveMatch({
               recurrentTransactionId, strIterationKey, transactionId,
               boolDone: true, dateDone: today, strMatchMode: 'AUTOMATIC' })

  7. Reset ImportWizardState
  8. Check storage usage; warn if > 4 MB
  9. Navigate to ROUTES.CONCILIATION

localStorage writes per step:
  Step 1: none
  Step 2: soft-deletes only (context transactions trash icon)
  Step 3: pfmg_import_batches, pfmg_transactions,
          pfmg_credit_cards / pfmg_debit_accounts (balance update),
          pfmg_recurrent_matches (0–N new records)
```

---

## 9 — Excel Parsing Rules

Column header constants are defined at the top of `ExcelParserService` for easy maintenance when the bank changes its export format. All fields below refer to `RawImportRow` (declared in `import-batch.model.ts`).

### 9.1 Credit card Excel columns

| Column header constant | Column header value | `RawImportRow` field | Notes |
|---|---|---|---|
| `COL_FECHA` | `'Fecha'` | `dateTransaction` | Date; SheetJS returns JS Date when `cellDates: true`; formatted as `YYYY-MM-DD` |
| `COL_DESCRIPCION` | `'Descripcion'` | `description` | String; trimmed |
| `COL_MONEDA` | `'Moneda'` | `currency` | `'S/'` → `'PEN'`; `'$'` → `'USD'` |
| `COL_MONTO` | `'Monto'` | `amount` | Number; sign preserved as-is from file |
| *(computed)* | — | `amountPen` | `(currency === 'PEN') ? amount : amount * usdExchangeRate`; computed at parse time |

### 9.2 Debit account Excel columns

Same as credit card plus:

| Column header constant | Column header value | `RawImportRow` field | Notes |
|---|---|---|---|
| `COL_OPERACION` | `'N° Operacion'` | `strOperationNumber` | String; used for D1 dupe detection |
| `COL_OPERACION_ALT` | `'Operacion'` | `strOperationNumber` | Fallback if primary column is absent |

If both operation number columns are absent, `strOperationNumber` is `undefined` and the row falls through to rules A1/A2/P1/P2/P3.

### 9.3 Row filtering

Rows where `Fecha`, `Descripcion`, `Moneda`, or `Monto` are null/empty are silently discarded before annotation.

### 9.4 amountPen computation

`amountPen` is always computed by `ExcelParserService.parseFile()` at parse time using the `usdExchangeRate` parameter. Downstream services and Step 3 of the wizard use `row.amountPen` directly — there is no re-conversion at any later stage.

---

## 10 — Monthly Dashboard Calculation

### 10.1 Purpose

Given a target month (`'YYYY-MM'`), compute the total income, total expenses, and a subcategory breakdown from the full transaction set. Used by `MonthlyDashboardComponent` via `DashboardCalculatorService.computeMonthly()`.

### 10.2 Transaction set

- Include: ACTIVE and PENDING transactions.
- Exclude: DELETED transactions.
- Month filter: `transaction.dateTransaction.startsWith(month)` — string prefix match; no date parsing required.
- All accounts included (credit cards and debit accounts combined).

### 10.3 Income / Expense classification

| Condition | Classification |
|---|---|
| `decAmountPen > 0` | Income |
| `decAmountPen < 0` | Expense |
| `decAmountPen === 0` | Excluded from both totals |

Transfers are not excluded. A debit-to-debit transfer adds `−amount` on the source and `+amount` on the destination; the net effect across all accounts is zero, so combined totals remain accurate.

### 10.4 Decision Tree

```
function computeMonthly(month, transactions, subcategories, categories):
  inMonth = transactions where strStatus != 'DELETED'
                           and dateTransaction starts with month

  totalIncome   = sum(t.decAmountPen) for t in inMonth where t.decAmountPen > 0
  totalExpenses = sum(t.decAmountPen) for t in inMonth where t.decAmountPen < 0
  netAmount     = totalIncome + totalExpenses   // negative = net expense month

  // Group by subcategory
  subcategoryMap = {}
  for t in inMonth where t.subcategoryId is not null:
    subcategoryMap[t.subcategoryId] += t.decAmountPen

  bySubcategory = for each (id, total) in subcategoryMap:
    sub = find subcategory by id
    cat = find category by sub.categoryId
    yield { subcategoryId: id, subcategoryName: sub.strName,
            categoryName: cat.strName, total }

  uncategorizedTotal = sum(t.decAmountPen) for t in inMonth where t.subcategoryId is null

  return { month, totalIncome, totalExpenses, netAmount, bySubcategory, uncategorizedTotal }
```

### 10.5 Display conventions

- `totalExpenses` is stored as a negative number; the UI displays `abs(totalExpenses)` in red.
- `netAmount` is displayed with sign: red if negative (net expense), green if positive (net income).
- `bySubcategory` is sorted by `abs(total)` descending so the highest-spending subcategory appears first.
- The "Uncategorized" row is always shown last regardless of amount.
