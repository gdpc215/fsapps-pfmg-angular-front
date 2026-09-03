# fsapps-pfmg — Project Overview & Design Findings

**Compiled:** 2026-09-02
**Purpose:** A single orientation document explaining what this app is, what has been designed, and where the code actually stands today. Derived from the design docs in `docs/plans/`, the two handoffs in `docs/handoff/`, and a read of the current `src/`.

---

## 1. What this app is

A **personal finance tracker** for one user who manages several **credit cards** and **savings (debit) accounts** at a Peruvian bank (BCP-style). The workflow it is built around:

1. Download an Excel statement from the bank.
2. Import it into the app. The app parses it, flags likely duplicates against what was already imported, and auto-assigns a spending category to each row.
3. Review and confirm the import.
4. For credit cards, run a monthly **cycle conciliation**: enter the balance the bank reports, and the app computes what the balance *should* be from recorded transactions and books the difference as interest.
5. Track **recurrent charges** (subscriptions, insurance) and see which have hit this month/year.
6. Track **transfers** between accounts (debit→debit) and card payments (debit→credit).

Bank file shape: columns `Fecha`, `Descripcion`, `Moneda` (`S/` = PEN, `$` = USD), `Monto` (negative = charge, positive = payment/refund); debit statements add `N° Operacion`.

This is an **early, local-only alpha**: everything runs in the browser, data is persisted to `localStorage`, there is no backend and no HTTP. A full-stack design (Java + SQL Server) exists as the eventual target.

---

## 2. Current state of the code — essentially nothing built yet

The design is complete and detailed; **implementation has not started.**

`src/app/` today contains only the stock FireSarge Angular template:

| Present | What it is |
|---|---|
| `application/` | `app.module.ts`, `app.component.*`, `app.routes.module.ts`, `app.routes.catalog.ts` — routing shell. Catalog only knows `HOME`, `ABOUT`, `ERROR`. |
| `features/app/home`, `features/app/about` | Placeholder pages ("Lorem ipsum…"). |
| `features/error` | Generic error page. |
| `features/transactions/movements`, `features/transactions/import-movements` | **Empty directories** — stubbed, no files. |
| `logic/` | `BaseService` (HTTP + localStorage helpers), `test.service.ts`, `user.ts` type, `constants.ts`, `utilities.ts`, `animations.ts`. Template boilerplate, not finance code. |
| `shared/_frame/` | `FrameComponent` — page chrome (title bar, footer "FireSarge Apps © 2024"). |

None of the designed entities, services, feature modules, or screens exist. There is no `core/models/`, no `StorageService`, no `ExcelParserService`, no feature folders for credit-cards / import / conciliation / categories / recurrent-transactions / debit-accounts.

**Dependency gap vs. the design's stated stack:**

| Design says | Actually in `package.json` |
|---|---|
| Angular 19 + Angular Material 19 + CDK | ✅ present (`@angular/material` 19, `@angular/cdk` 19) |
| Tailwind CSS 3 | ✅ present (devDependency) |
| SheetJS (`xlsx`) for Excel parsing | ❌ **not installed** — Phase 1 step 1 is `npm install xlsx` |
| RxJS `BehaviorSubject` (no NgRx) | ✅ RxJS present |
| `crypto.randomUUID()` | browser-native |

Also present but unused by the design: `date-fns`, `moment`, `@angular/material-moment-adapter`.

---

## 3. The design corpus

Eight documents in `docs/plans/` + two handoffs. There are three numbered generations of each design; **the highest number is current.**

| File | Role | Current? |
|---|---|---|
| `plans/DESIGN_LOCAL_v3.md` | **The implementation target.** localStorage-only Angular app, full service/component layout, wizard data flow, migration path. v1.2. | ✅ **use this** |
| `plans/DESIGN_LOCAL_v1.md` / `_v2.md` | Earlier drafts of the same. v1.0 / v1.1. | superseded |
| `plans/DESIGN_v2.md` | Full-stack design: Angular + Java 21 Azure Functions + MS SQL Server. DDL, stored procs, REST endpoints, DTOs, Open Questions. v1.1. | ✅ future target |
| `plans/DESIGN_v1.md` | Earlier full-stack draft. v1.0. | superseded |
| `plans/BUSINESS_LOGIC.md` | **Authoritative algorithms** — decision trees and pseudocode for every rule system. Referenced by both designs. v1.1. | ✅ source of truth for logic |
| `handoff/handoff-20260513-190725.md` | End of design session 1 — all docs drafted. | historical |
| `handoff/handoff-20260514-144732.md` | End of design session 2 — v1.1→v1.2 changes (see §8). | **latest handoff** |

Relationship: `DESIGN_LOCAL_v3` and `DESIGN_v2` describe the *same product* at two infrastructure levels. Where either describes logic "at a high level", `BUSINESS_LOGIC.md` has the precise version. Build `DESIGN_LOCAL_v3` first for fast UI iteration, then swap the persistence layer to reach `DESIGN_v2` (§10).

> Note: filenames/versions inside the docs and the 112-day-old project memory still say `DESIGN.md` / `DESIGN_LOCAL.md` (unsuffixed) and "v1.1". Those are the files now suffixed `_v2` / `_v3` and bumped to v1.1 / v1.2. Cross-references inside the docs may point at the old names.

---

## 4. Architecture (local-only variant)

Layered, and deliberately structured so only one layer changes when the backend arrives:

```
Components (feature modules, lazy-loaded)
      │  bind to Observable streams
Feature services  ── own a BehaviorSubject per collection, re-emit on write
      │  the ONLY layer that talks to persistence
StorageService  ── single owner of localStorage; emits changes$ on every write
      │
localStorage  ── one key per collection, JSON array, prefix pfmg_
```

Alongside the feature services sit **pure business-logic services** — `ExcelParserService`, `DuplicationLogicService`, `CategoryMatchingService`, `ConciliationCalculatorService`, `RecurrentMatchingService`. They have no injected dependencies, take plain data, return results. They are identical in the local and backend variants (and mirror the Java `*Logic` classes).

- Framework: Angular 19, standalone-component lazy routes under a `ShellComponent` (sidenav + `router-outlet`).
- UI: Angular Material 19 + Tailwind 3.
- State: RxJS `BehaviorSubject`, no NgRx.
- IDs: `crypto.randomUUID()`. Dates stored as `YYYY-MM-DD` strings; `dateCreation`/`dateModification` are ISO strings managed by `StorageService`.
- `localStorage` budget: ~5 MB usable ≈ 8–12k transactions ≈ 6–10 years of use. `StorageService.getTotalBytes()` drives a warning banner past 4 MB.

### localStorage keys

`pfmg_credit_cards`, `pfmg_debit_accounts`, `pfmg_transactions`, `pfmg_import_batches`, `pfmg_categories`, `pfmg_subcategories`, `pfmg_category_rules`, `pfmg_duplication_collections`, `pfmg_cycle_snapshots`, `pfmg_cycle_closes`, `pfmg_recurrent_transactions`, `pfmg_recurrent_matches`.

---

## 5. Domain model

All entities extend `BaseEntity { id, dateCreation, dateModification }`.

| Entity | Key fields | Notes |
|---|---|---|
| **CreditCard** | `strName`, `intClosingDay` (1–31), `intPaymentDay` (1–31), `decCurrentBalance` | Balance negative = owed. Updated after every import and every conciliation. |
| **DebitAccount** | `strName`, `decCurrentBalance` | Savings. Balance positive. No conciliation. |
| **Transaction** | `accountId` + `accountType` (`CREDIT_CARD`\|`DEBIT_ACCOUNT`), `importBatchId?`, `dateTransaction`, `strDescription`, `strCurrency` (`PEN`\|`USD`), `decAmount`, `decAmountPen`, `subcategoryId?`, `strNotes?`, `strStatus` (`ACTIVE`\|`PENDING`\|`DELETED`), `strOperationNumber?`, `transferGroupId?` | One table for both account types. `decAmount` keeps bank sign. `decAmountPen` fixed at import time, never re-converted. |
| **ImportBatch** | `accountId`+`accountType`, `dateImport`, `decUsdExchangeRate`, `decBalanceAtImport` | One per import event. Credit balance stored negated. |
| **RawImportRow** | `dateTransaction`, `description`, `currency`, `amount`, `amountPen`, `strOperationNumber?` | Transient — a parsed Excel row before business logic. Not persisted. |
| **Category / Subcategory** | `strName`; Subcategory has `categoryId` | Two-level. Transactions link to a Subcategory. |
| **CategoryRule** | `subcategoryId`, `strMatchString`, `strMatchType` (`STARTS_WITH`\|`CONTAINS`\|`ENDS_WITH`\|`EQUALS`), `intPriority` | Lower priority number wins; first match assigns the subcategory. |
| **DuplicationCollection** | `strName`, `strings[]` | Named synonym sets (e.g. "UBER", "UBER EATS", "UBER TRIP") for cross-description dupe matching (rule P3). |
| **RecurrentTransaction** | `strName`, `accountId`+`accountType`, `strFrequency` (`MONTHLY`\|`YEARLY`), `strMatchMode` (`MANUAL`\|`AUTOMATIC`), + automatic-only: `strCurrency?`, `decApproxAmount?`, `decAmountRange?`, `strMatchString?`, `intApproxDay?`, `intApproxMonth?`, `intDayRange?` | Template for a known periodic charge. |
| **RecurrentTransactionMatch** | `recurrentTransactionId`, `strIterationKey` (`YYYY-MM` or `YYYY`), `transactionId?`, `boolDone`, `dateDone?`, `strMatchMode` | One per iteration. `transactionId` optional (e.g. paid in cash → done, unlinked). |
| **CycleSnapshot** | `cardId`, `dateSnapshot`, `decBalanceAtSnapshot`, `strType` (`SNAPSHOT`\|`CYCLE_CLOSE`) | Mid-cycle or closing balance record. |
| **CycleClose** | `cardId`, `dateClosing`, `decOpeningBalance`, `decClosingBalance`, `decInterestAmount`, `interestTransactionId?` | Finalized cycle reconciliation. Chains: this close's `decClosingBalance` is next cycle's opening. |

**Sign convention (global):** negative `decAmount` = money leaving (charge / outgoing payment); positive = money entering (payment / refund / incoming transfer). Card "you owe 1500" is stored `-1500`. User types balances as positive numbers; the system negates internally (`-Math.abs(entered)`).

---

## 6. The seven business-logic systems

All fully specified in `BUSINESS_LOGIC.md`. Summary:

### 6.1 Duplication detection (import Step 1→2)
Each incoming row is compared to all **ACTIVE** transactions for that account. First rule to match wins:

| Rule | Type | Condition |
|---|---|---|
| **D1** | AUTO (debit only) | same `strOperationNumber` + same date |
| **A1** | AUTO | same date + description + currency + amount |
| **A2** | AUTO (USD only) | same description + amount, date within ±3 days |
| **P1** | POTENTIAL | same amount + first 10 chars of description (case-insensitive) + date ±3d |
| **P2** | POTENTIAL | same amount + date ±3d (any description) |
| **P3** | POTENTIAL | incoming & existing descriptions both contain a string from the same DuplicationCollection + same amount + same currency + date ±3d |

AUTO rows import unchecked and greyed; POTENTIAL rows import checked but highlighted with the matching transaction shown beneath. `daysDiff` uses `<= 3` (a 3-day gap counts).

### 6.2 Category auto-matching
Rules sorted by `intPriority` ASC; first `strMatchType` hit returns its `subcategoryId`; else undefined. Priorities must be unique (UI enforces via bulk drag-reorder, assigning 10, 20, 30…).

### 6.3 Cycle conciliation (credit cards only)
```
cycleStart  = (closingDay + 1) of previous month
closingDate = closingDay of current month
openingBalance        = previous CycleClose.decClosingBalance  (0 if first cycle)
cycleMovementsSum     = Σ decAmountPen of ACTIVE txns in [cycleStart, closingDate]
amountA               = openingBalance + cycleMovementsSum          (expected closing)
postCloseMovementsSum = Σ decAmountPen of ACTIVE txns in (closingDate, today]
amountB               = -abs(enteredBalance) - postCloseMovementsSum (implied closing)
interest              = amountB - amountA        (0 if |diff| < 0.01 PEN)
```
On confirm: if interest ≠ 0 create a `Transaction` dated `closingDate`, description `INTERES`, `decAmount = interest`; write a `CycleClose` and a `CycleSnapshot(CYCLE_CLOSE)`; set `card.decCurrentBalance = amountB`.

### 6.4 Recurrent transaction matching
Iteration key: `YYYY-MM` (monthly) / `YYYY` (yearly). At most one match per key — skip the scan entirely if one already exists.
**MANUAL:** user links a transaction, or marks done without a link.
**AUTOMATIC:** scan ACTIVE transactions filtered by account, account type, optional currency, amount within `abs(decApproxAmount) ± decAmountRange` (sign must match), optional description CONTAINS, and date within `intDayRange` of the target day. First hit wins.
Dashboard status per entry: `NOT_YET_DUE` / `PENDING` / `DONE`.

### 6.5 Transfers
Two `Transaction` rows sharing a generated `transferGroupId` — source negative, destination positive. Created fresh as a pair, or by linking two already-imported rows.

### 6.6 Transaction status transitions
`ACTIVE ↔ PENDING`, `ACTIVE → DELETED`, `PENDING → DELETED`, `DELETED → ACTIVE` (restore, via admin/debug view). `DELETED → PENDING` not supported. PENDING is included in balance estimates and can be set from the import wizard's Step 2 context menu.

### 6.7 Excel parsing
Column names are constants at the top of `ExcelParserService`. `S/`→PEN, `$`→USD. Rows missing any of Fecha/Descripcion/Moneda/Monto are discarded. `amountPen = currency === 'PEN' ? amount : amount * usdExchangeRate` computed once at parse time; never recomputed downstream. Debit: reads `N° Operacion`, falls back to `Operacion`.

---

## 7. Planned screen / feature surface

Lazy-loaded feature modules under a shell layout (`DESIGN_LOCAL_v3` §8):

| Feature | Screens |
|---|---|
| **credit-cards** | card list, card form (name / closing day / payment day) |
| **debit-accounts** | account list, account form |
| **import** | 3-step wizard — Step 1 Upload, Step 2 Review, Step 3 Finalize — driven by an in-memory `ImportWizardStateService` |
| **transactions** | per-account list (grouped by date, filterable), detail with inline subcategory + notes edit |
| **categories** | category/subcategory CRUD, category-rule list with drag-to-reorder, duplication-collection CRUD |
| **conciliation** | conciliation form + result preview table, conciliation history |
| **recurrent-transactions** | recurrent list, recurrent form (manual/automatic toggle), dashboard (current-iteration status) |
| shared | confirm dialog, amount-display component, PEN currency pipe, storage-warning banner |

### Import wizard — where writes happen
Steps 1 and 2 are **pure in-memory**. The only write possible in Step 2 is a soft-delete when the user trashes a nearby existing transaction. **Everything else is deferred to Step 3 "Save & Finish"**, in order: create `ImportBatch` → `saveMany()` checked transactions → update account balance → run automatic recurrent matching against the new active set → storage-size check → reset wizard → navigate to Conciliation. If the user abandons mid-wizard, `localStorage` is untouched.

---

## 8. What changed most recently (v1.1 → v1.2, handoff 2026-05-14)

1. **Import wizard: 2 steps → 3 steps.** Old Step 2 had a "Confirm" that wrote data. Now Step 2 ends with "Next →" and a new **Step 3 (Finalize)** owns all writes and shows a read-only summary first.
2. **Step 3 also runs automatic recurrent matching** against the just-imported transactions and navigates to the conciliation page on completion.
3. **`RawImportRow` moved** from inside `excel-parser.service.ts` to `core/models/import-batch.model.ts`; fields renamed Spanish→English (`fecha`→`dateTransaction`, `descripcion`→`description`, `moneda`→`currency`, `monto`→`amount`); added `amountPen`.
4. **`parseFile()` now takes `usdExchangeRate`** and computes `amountPen` at parse time.
5. **Excel column headers extracted to named constants** at the top of the parser.

**Known doc debt:** `BUSINESS_LOGIC.md` §8 (Import Wizard flow) and §9 (Excel parsing) still partly reference the old two-step flow / Spanish field names. Reconcile before implementing Phase 3. (BUSINESS_LOGIC header says v1.1 and appears mostly updated, but the handoff flags this — verify.)

---

## 9. Key decisions already locked (do not re-litigate)

- Amounts follow bank-statement sign convention (negative = spend).
- USD → PEN conversion is fixed at import time and stored in `decAmountPen`; never re-converted, even at conciliation.
- One `Transaction` table; `accountId` + `accountType` rather than separate tables.
- Six dedupe rules, first match wins.
- Priority-ordered category rules, first match wins, four match types.
- Conciliation is credit-card-only.
- Recurrent: one match per iteration, stop after first.
- Transfers = two transactions + shared `transferGroupId`.
- `decCurrentBalance` cached on both account entities, refreshed after every import (and conciliation, for cards).
- All import writes deferred to wizard Step 3.
- `StorageService` is the sole `localStorage` owner; no component or feature service touches it directly.

---

## 10. Open questions (assumed answers in place; confirm before building conciliation)

| ID | Question | Working assumption |
|---|---|---|
| OQ-1 | Does the UI take a positive balance and negate internally? | Yes — label "amount you owe", ×−1 before store |
| OQ-2 | First-cycle opening balance when no prior `CycleClose`? | 0, with a manual override field for the first close |
| OQ-3 | Multi-currency conciliation uses `decAmountPen` at import rate? | Yes — may drift from real balance if FX moved |
| OQ-4 | Ordering of transactions within the same day (no time in file)? | Insertion order (`dateCreation ASC`) |
| OQ-5 | Category-rule priority tiebreaker? | Enforce unique priorities via bulk reorder |

---

## 11. Path forward

**Phase 1 — scaffold:** `npm install xlsx`; create `core/models/` (all interfaces from `DESIGN_LOCAL_v3` §3); implement `StorageService` + `STORAGE_KEYS`; wire the shell layout + lazy routes.
**Phase 2 — accounts:** credit card and debit account list + form.
**Phase 3 — import wizard:** `ExcelParserService`, `DuplicationLogicService`, `CategoryMatchingService`, `ImportWizardStateService`, Steps 1–3.
**Phase 4 — categories:** category/subcategory CRUD, rule list with drag-reorder, duplication collections.
**Phase 5 — transactions:** per-account list, inline subcategory/notes edit.
**Phase 6 — recurrent:** `RecurrentMatchingService`, CRUD form, dashboard.
**Phase 7 — conciliation:** `ConciliationCalculatorService`, form + preview, history.
**Phase 8 — transfers:** create-pair / link-two UI, linked badge in the list.
**Phase 9 — doc cleanup:** finish reconciling `BUSINESS_LOGIC.md` §8–§9.
**Phase 10 — backend migration:** replace `StorageService` calls in feature services with `HttpClient` against the `DESIGN_v2` endpoints, one feature at a time. Business-logic services, components, templates, models, and `ImportWizardStateService` do **not** change.

---

## 12. Backend target (for context — not built)

`DESIGN_v2.md` specifies the eventual full stack: Java 21 + Spring Boot 3.3.6 on Azure Functions (HTTP triggers), MS SQL Server via `JdbcTemplate` with **stored procedures only**, `CustomRowMapper` for `ResultSet` mapping, `AsyncDBHelper` over `CompletableFuture`, Apache POI for Excel. It includes full DDL (12 `M_*` tables with indexes and FKs), a representative stored-proc set, per-feature Java package layout (`handler` / `Logic` / `Entity` / `Repository` / `.sql`), and a complete REST endpoint catalogue. The two stateless algorithm classes — `DuplicationLogic` and `RecurrentMatchingLogic` — are the Java twins of the Angular pure services.
