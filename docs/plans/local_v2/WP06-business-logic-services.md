# WP06 — Business Logic Services

**Depends on:** WP01  
**Spec:** DESIGN_LOCAL_v5.md §7 + BUSINESS_LOGIC_v2.md (all sections)

---

## Goal

Implement all six pure/stateless business logic services. They do **not** inject `StorageService` or feature services. They accept plain data and return results. The full algorithms are in `BUSINESS_LOGIC_v2.md` — this document calls out the key implementation points for each service.

---

## Step 1 — `ExcelParserService`

File: `src/app/core/services/excel-parser.service.ts`

Full implementation in DESIGN_LOCAL_v5.md §7.1 and BUSINESS_LOGIC_v2.md §9.

**Critical implementation points:**
- Import SheetJS: `import * as XLSX from 'xlsx';`
- Pre-parse guards (throw `ParseValidationError` before `arrayBuffer()` call):
  - Extension check: `!file.name.toLowerCase().endsWith('.xlsx')`
  - Size check: `file.size > 10 * 1024 * 1024`
- `cellDates: true` in XLSX.read options so dates come as JS Date objects.
- `parseDate()` uses `getFullYear()`, `getMonth()`, `getDate()` (local components) — NOT `toISOString()` which uses UTC.
- `parseAmount()` strips commas then `Number()`; returns `0` on NaN.
- Currency mapping: `'S/'` → `'PEN'`; `'$'` → `'USD'`.
- `strOperationNumber`: try `COL_OPERACION` first, then `COL_OPERACION_ALT`, then `undefined`.
- Filter out rows where any of Fecha/Descripcion/Moneda/Monto is null after parsing.
- Return `{ rows, hasMultipleSheets, hasUsdRows }` where `hasUsdRows = rows.some(r => r.currency === 'USD')`.

Copy the full service code from DESIGN_LOCAL_v5.md §7.1 verbatim.

---

## Step 2 — `DuplicationLogicService`

File: `src/app/core/services/duplication-logic.service.ts`

Full algorithm in BUSINESS_LOGIC_v2.md §2.

**Exported types** (used by Import Wizard components):
```typescript
export type DuplicationFlag = 'NONE' | 'AUTO_DUPLICATE' | 'POTENTIAL_DUPLICATE';

export interface AnnotatedImportRow {
  raw: RawImportRow;
  flag: DuplicationFlag;
  matchingTransaction?: Transaction;
  subcategoryId?: string;
  note?: string;
  pendingFlag?: boolean;
  checked: boolean;
}
```

**Public method signature:**
```typescript
annotate(
  incoming: RawImportRow[],
  existing: Transaction[],
  collections: DuplicationCollection[],
  accountId: string,
  accountType: AccountType,
  boolP2Enabled: boolean
): AnnotatedImportRow[]
```

**Pre-filter (inside `annotate`):**
```typescript
const activeForAccount = existing.filter(
  t => t.accountId === accountId && t.strStatus === 'ACTIVE'
);
```

**Rule order in `annotateRow` (first match wins):**
1. D1 — debit only: same `strOperationNumber` + same `dateTransaction` → AUTO_DUPLICATE
2. A1 — exact match: same date + description + currency + `amountsMatch` → AUTO_DUPLICATE
3. A2 — USD floating: USD only, same description + `amountsMatch` + `daysDiff <= 3` → AUTO_DUPLICATE
4. P1 — prefix: `amountsMatch` + first 10 chars of description (case-insensitive) match + `daysDiff <= 3` → POTENTIAL_DUPLICATE
5. P2 — opt-in (skip if `boolP2Enabled === false`): `amountsMatch` + `daysDiff <= 3` → POTENTIAL_DUPLICATE
6. P3 — collection-based: for each collection, if row.description contains any string AND existing.strDescription contains any string from same collection + `amountsMatch` + same currency + `daysDiff <= 3` → POTENTIAL_DUPLICATE
7. Default: flag=NONE, checked=true

**Helpers:**
```typescript
private amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

private daysDiff(dateA: string, dateB: string): number {
  return Math.abs(new Date(dateA).getTime() - new Date(dateB).getTime()) / 86_400_000;
}
```

Copy the full service code from DESIGN_LOCAL_v5.md §7.2 verbatim.

---

## Step 3 — `CategoryMatchingService`

File: `src/app/core/services/category-matching.service.ts`

Full algorithm in BUSINESS_LOGIC_v2.md §3. Simple priority-ordered matching.

```typescript
import { Injectable } from '@angular/core';
import { CategoryRule } from '../models/category-rule.model';

@Injectable({ providedIn: 'root' })
export class CategoryMatchingService {
  match(description: string, rules: CategoryRule[]): string | undefined {
    const sorted = [...rules].sort((a, b) => a.intPriority - b.intPriority);
    const desc = description.toLowerCase();
    for (const rule of sorted) {
      const pattern = rule.strMatchString.toLowerCase();
      let matched = false;
      switch (rule.strMatchType) {
        case 'STARTS_WITH': matched = desc.startsWith(pattern); break;
        case 'CONTAINS':    matched = desc.includes(pattern);   break;
        case 'ENDS_WITH':   matched = desc.endsWith(pattern);   break;
        case 'EQUALS':      matched = desc === pattern;         break;
      }
      if (matched) return rule.subcategoryId;
    }
    return undefined;
  }
}
```

---

## Step 4 — `ConciliationCalculatorService`

File: `src/app/core/services/conciliation-calculator.service.ts`

Full algorithm in BUSINESS_LOGIC_v2.md §4.

**Exported interfaces:**
```typescript
export interface CycleWindow {
  cycleStart: string;   // YYYY-MM-DD
  closingDate: string;  // YYYY-MM-DD
}

export interface ConciliationInput {
  cardId: string;
  intClosingDay: number;
  todayDate: string;
  currentBalance: number;
  previousClosingBalance: number;
  nonDeletedTransactions: Transaction[];
}

export interface ConciliationResult {
  window: CycleWindow;
  openingBalance: number;
  cycleMovementsSum: number;
  amountA: number;
  postCloseMovementsSum: number;
  currentBalanceNegated: number;
  amountB: number;
  interestAmount: number;
}
```

**Key behaviors:**
- `buildCycleWindow()` clamps `intClosingDay` to `daysInMonth(year, month)` for both current and previous month.
- `cycleStart = prevMonthClampedDay + 1` (day after previous closing).
- `closingDate` is in the current month.
- `todayDate + 'T12:00:00'` noon constructor to avoid DST edge cases.
- `cycleMovementsSum`: ACTIVE only, in `[cycleStart, closingDate]`.
- `postCloseMovementsSum`: non-DELETED (includes PENDING), in `(closingDate, todayDate]` — note exclusive start.
- `currentBalanceNegated = -Math.abs(input.currentBalance)`.
- `interestAmount = (Math.abs(rawInterest) < 0.01) ? 0 : rawInterest`.
- `daysInMonth` is a public method (used by `DashboardCalculatorService`).

Copy the full service code from DESIGN_LOCAL_v5.md §7.4 verbatim.

---

## Step 5 — `RecurrentMatchingService`

File: `src/app/core/services/recurrent-matching.service.ts`

Full algorithm in BUSINESS_LOGIC_v2.md §5.

**Key methods:**

`findAutomaticMatches(recurrents, existingMatches, activeTransactions, todayDate)`:
- For each recurrent with `strMatchMode === 'AUTOMATIC'`:
  - Compute current `iterationKey`.
  - Check `alreadyMatched` guard (skip if match record exists for this recurrent + iteration key).
  - Run `findAutomaticMatch()` algorithm.
  - If match found, add to results.
- Returns array of `{ recurrent, transaction, iterationKey }`.

`findAutomaticMatch(recurrent, activeTransactions, todayDate)`:
- Compute `iterationKey` and `targetDate` via `buildTargetDate`.
- Filter `activeTransactions` by `accountId` and `accountType`.
- Filter by currency (if `strCurrency` defined).
- Filter by sign match (`decApproxAmount` sign vs `t.decAmount` sign).
- Filter by absolute amount within `[absApprox - range, absApprox + range]`.
- Filter by `strMatchString` (case-insensitive contains).
- Filter by date within `intDayRange` of `targetDate`.
- Return first match.

`buildTargetDate(recurrent, iterationKey)`:
- If `intApproxDay` is null/undefined: return `undefined`.
- MONTHLY: parse year/month from `iterationKey` (`YYYY-MM`), clamp day to `daysInMonth`.
- YEARLY: parse year from `iterationKey` (`YYYY`), use `intApproxMonth ?? 1`, clamp day.

**`getCurrentIterationKey(frequency, todayDate)`:**
```typescript
private getCurrentIterationKey(frequency: RecurrenceFrequency, todayDate: string): string {
  return frequency === 'MONTHLY' ? todayDate.slice(0, 7) : todayDate.slice(0, 4);
}
```

**`getPreviousIterationKey(frequency, currentKey)`:**
```typescript
private getPreviousIterationKey(frequency: RecurrenceFrequency, currentKey: string): string {
  if (frequency === 'MONTHLY') {
    const [y, m] = currentKey.split('-').map(Number);
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    return `${prevY}-${String(prevM).padStart(2, '0')}`;
  }
  return String(Number(currentKey) - 1);
}
```

Make `buildTargetDate`, `getCurrentIterationKey`, `getPreviousIterationKey`, and `daysInMonth` **public** — the recurrent dashboard component uses them directly.

---

## Step 6 — `DashboardCalculatorService`

File: `src/app/core/services/dashboard-calculator.service.ts`

Full algorithm in BUSINESS_LOGIC_v2.md §10 (monthly) and §11 (balance computation). Also handles cycle summary (§14).

**Exported interfaces:**
```typescript
export interface SubcategoryTotal {
  subcategoryId: string;
  subcategoryName: string;
  categoryName: string;
  total: number;
}

export interface MonthlyDashboardData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  bySubcategory: SubcategoryTotal[];
  uncategorizedIncome: number;
  uncategorizedExpenses: number;
  pendingCount: number;
  pendingTotal: number;
}

export interface CycleDashboardCardData {
  card: CreditCard;
  cycleWindow: CycleWindow;
  totalExpenses: number;
  totalPayments: number;
  transactionCount: number;
  topSubcategories: SubcategoryTotal[];
  balanceAtLastImport: number;
  balanceImportDate: string;
}
```

**`computeCurrentBalance(accountId, importBatches)`:**
- Filter batches by `accountId`.
- Sort by `dateImport` DESC.
- Return `{ balance: latest.decBalanceAtImport, importDate: latest.dateImport }` or `{ balance: 0, importDate: undefined }` if none.

**`computeMonthly(month, transactions, subcategories, categories, hideTransfers)`:**
- Include ACTIVE + PENDING, exclude DELETED.
- Filter by `dateTransaction.startsWith(month)`.
- If `hideTransfers`: exclude rows where `transferGroupId != null`.
- Split categorized vs uncategorized.
- `groupBySubcategory()` — private helper, builds sorted `SubcategoryTotal[]`.
- `bySubcategory` sorted: `Math.abs(b.total) - Math.abs(a.total)` then `a.subcategoryName.localeCompare(b.subcategoryName)` (stable sort).

**`computeCycleSummary(card, todayDate, transactions, importBatches, subcategories, categories)`:**
- Build `cycleWindow` via `ConciliationCalculatorService.buildCycleWindow()` (inject the service).
- Filter transactions: non-DELETED, `accountId === card.id`, in `[cycleStart, closingDate]`.
- `topSubcategories`: top 3 by `abs(total)`, same sort as `bySubcategory`.

Copy the full service code from DESIGN_LOCAL_v5.md §7.6 verbatim.

`DashboardCalculatorService` injects `ConciliationCalculatorService`. Use constructor injection — this is NOT circular since neither service depends on feature services.

---

## Acceptance Criteria

- `npm run build` passes.
- `ConciliationCalculatorService.buildCycleWindow(31, '2026-02-10')` returns `{ cycleStart: '2026-01-29', closingDate: '2026-02-28' }`.
- `RecurrentMatchingService.buildTargetDate({ intApproxDay: 30, strFrequency: 'MONTHLY' }, '2026-02')` returns `'2026-02-28'`.
- `DuplicationLogicService.annotate()` returns `AUTO_DUPLICATE` for an exact-match row and `NONE` for a non-matching row.
- `CategoryMatchingService.match()` returns the first matching subcategoryId when sorted by `intPriority ASC`.
- `ExcelParserService.parseFile()` throws `ParseValidationError` for a non-.xlsx extension.
