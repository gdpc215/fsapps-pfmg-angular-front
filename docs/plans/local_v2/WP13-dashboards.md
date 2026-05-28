# WP13 — Monthly Dashboard & Cycle Dashboard

**Depends on:** WP01, WP02, WP03, WP04, WP05, WP06  
**Spec:** DESIGN_LOCAL_v5.md §13, §14; BUSINESS_LOGIC_v2.md §10, §11

---

## Goal

Replace the dashboard stub module with two dashboard pages in a single lazy-loaded `DashboardModule`.

---

## `DashboardModule`

File: `src/app/features/dashboard/dashboard.module.ts`

Routes:
```
'monthly'  → MonthlyDashboardComponent
'cycle'    → CycleDashboardComponent
''         → redirect to 'cycle'
```

Import: `SharedModule`, `MatCardModule`, `MatIconModule`, `MatDividerModule`, `MatTableModule`, `MatButtonModule`, `MatSlideToggleModule`, `MatChipsModule`, `MatBadgeModule`.

---

## `MonthlyDashboardComponent`

Files:
- `src/app/features/dashboard/pages/monthly-dashboard/monthly-dashboard.component.ts`
- `src/app/features/dashboard/pages/monthly-dashboard/monthly-dashboard.component.html`

### Inject
`TransactionService`, `CategoryService`, `DashboardCalculatorService`, `ChangeDetectorRef`

### State
```typescript
selectedMonth: string;      // YYYY-MM; default = current month
currentMonth: string;       // YYYY-MM from today
hideTransfers = false;
data: MonthlyDashboardData | null = null;
```

### Month navigation

```typescript
changeMonth(delta: number): void {
  const [y, m] = this.selectedMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  this.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  this.recompute();
}
```

"Next →" button disabled when `selectedMonth >= currentMonth`.

### Recompute

```typescript
recompute(): void {
  this.data = this.dashboardCalc.computeMonthly(
    this.selectedMonth,
    this.transactionService.getAll(),
    this.categoryService.getSubcategories(),
    this.categoryService.getCategories(),
    this.hideTransfers
  );
  this.cdr.markForCheck();
}
```

Subscribe to `transactionService.transactions$` in `ngOnInit`; call `recompute()` on each emission.

### Template

**Controls row:**
```html
<div class="flex items-center gap-4">
  <button mat-icon-button (click)="changeMonth(-1)">
    <mat-icon>chevron_left</mat-icon>
  </button>
  <span class="text-lg font-semibold">{{ selectedMonth | date:'MMMM yyyy':'':'es' }}</span>
  <button mat-icon-button (click)="changeMonth(1)" [disabled]="selectedMonth >= currentMonth">
    <mat-icon>chevron_right</mat-icon>
  </button>
  <mat-slide-toggle [(ngModel)]="hideTransfers" (change)="recompute()">
    Hide transfers
  </mat-slide-toggle>
</div>
```

**Summary row** (three cards):
```
Income          Expenses           Net
S/ 5,000.00    S/ 3,250.50       S/ 1,749.50
(green)        (red, abs value)  (green if +, red if -)
```

**PENDING footnote** (shown only when `data.pendingCount > 0`):
> `* Includes {{ data.pendingCount }} pending transactions ({{ data.pendingTotal | currencyPen:true }})`

**Subcategory breakdown table** (sorted by `abs(total)` DESC, stable):

| Category | Subcategory | Total |
|---|---|---|
| Alimentación | Supermercado | S/ −350.00 |
| … | | |
| *(Uncategorized — income)* | — | `data.uncategorizedIncome` (green) |
| *(Uncategorized — expenses)* | — | `data.uncategorizedExpenses` (red) |

Uncategorized rows: only show if their value is non-zero.

---

## `CycleDashboardComponent`

Files:
- `src/app/features/dashboard/pages/cycle-dashboard/cycle-dashboard.component.ts`
- `src/app/features/dashboard/pages/cycle-dashboard/cycle-dashboard.component.html`

### Inject
`CreditCardService`, `TransactionService`, `ImportBatchService`, `CategoryService`, `DashboardCalculatorService`, `ChangeDetectorRef`

### State
```typescript
cardSummaries: CycleDashboardCardData[] = [];
todayDate: string = new Date().toISOString().slice(0, 10);
```

### Recompute

```typescript
recompute(): void {
  const cards    = this.creditCardService.getAll();
  const txns     = this.transactionService.getAll();
  const batches  = this.importBatchService.getAll();
  const subs     = this.categoryService.getSubcategories();
  const cats     = this.categoryService.getCategories();

  this.cardSummaries = cards.map(card =>
    this.dashboardCalc.computeCycleSummary(card, this.todayDate, txns, batches, subs, cats)
  );
  this.cdr.markForCheck();
}
```

Subscribe to `transactionService.transactions$` in `ngOnInit`; call `recompute()` on each emission.

### Template

**Page title:** "Cycle Dashboard"

**Empty state (no cards):** *"No credit cards configured. Add one to see cycle summaries →"* with a link to `/credit-cards`.

**Card widgets** — one `mat-card` per credit card:

```
┌──────────────────────────────────────────────┐
│  [card.strName]                              │
│  Cycle: [cycleStart] → [closingDate]         │
│                                              │
│  Expenses:          S/ −1,250.50             │
│  Payments:            S/ 500.00             │
│  Transactions:        12                     │
│                                              │
│  Balance at last import: S/ −750.50          │
│    (as of 10/05/2026)                        │
│                                              │
│  Top spending:                               │
│    Supermercado      S/ −350.00              │
│    Restaurantes      S/ −210.00              │
│    Streaming          S/ −89.90              │
└──────────────────────────────────────────────┘
```

**Balance display:**
```html
<p class="text-sm text-gray-600">
  Balance at last import:
  <span [class.text-red-600]="data.balanceAtLastImport < 0"
        [class.text-green-600]="data.balanceAtLastImport >= 0">
    {{ data.balanceAtLastImport | currencyPen:true }}
  </span>
</p>
<p *ngIf="data.balanceImportDate" class="text-xs text-gray-400">
  as of {{ data.balanceImportDate | date:'dd/MM/yyyy' }}
</p>
<p *ngIf="!data.balanceImportDate" class="text-xs text-gray-400">
  No import data available
</p>
```

**No transactions in cycle:** show *"No transactions in current cycle ([cycleStart] → [closingDate])."* inside the card if `transactionCount === 0`.

**Top subcategories:** up to 3 rows. If none, show nothing (or "No categorized transactions").

**PENDING included:** No special marking needed — PENDING is included by default, matching the monthly dashboard behavior.

---

## Date display format

Use Angular `DatePipe` with `'dd/MM/yyyy'` format throughout both dashboards.

Use `'MMMM yyyy'` for the month navigation label in monthly dashboard. Include locale `'es'` for Spanish month names if available in the Angular locale setup; otherwise English is acceptable.

---

## Acceptance Criteria

- Monthly dashboard defaults to current month.
- "Next" is disabled at the current month.
- Month navigation arithmetic never produces invalid months (uses `new Date(y, m-1+delta, 1)` approach).
- Transfers toggle recomputes the monthly data excluding `transferGroupId != null` rows.
- Uncategorized income and expenses shown as separate rows at the bottom of the breakdown.
- PENDING footnote shows only when `pendingCount > 0`.
- Cycle dashboard shows one card per credit card.
- Empty state shown when no credit cards exist.
- Balance shows "as of" date when import batch exists; "No import data" otherwise.
- Card summaries recompute whenever `transactions$` emits.
