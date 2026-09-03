# PFMG Build Plan — Sub-Agent Work Packages

**Spec sources:**
- `docs/plans/local_v1/DESIGN_LOCAL_v5.md` — architecture, interfaces, services, UI flows
- `docs/plans/local_v1/BUSINESS_LOGIC_v2.md` — algorithms, decision trees

## Project State (as of 2026-05-21)

The Angular 19 project already exists at `src/`. What exists:
- `src/app/application/` — AppModule, AppComponent (basic shell), AppRoutesModule, app.routes.catalog.ts (placeholder routes only)
- `src/app/features/app/` — placeholder Home and About pages
- `src/app/features/error/` — error page
- `src/app/shared/shared.module.ts` — empty shared module
- `src/app/logic/` — placeholder utilities/services (not pfmg-related)

Angular Material 19, Tailwind CSS 3, RxJS 7, date-fns are already installed.
SheetJS (`xlsx`) is NOT installed yet.

**Architecture constraints:**
- NgModule-based (not standalone). All components use `standalone: false`.
- Zoneless change detection (`provideExperimentalZonelessChangeDetection` in AppModule). Use `ChangeDetectionStrategy.OnPush` everywhere and `async` pipe for observables.
- No HTTP — pure `localStorage` via `StorageService`.
- All feature modules are lazy-loaded via `loadChildren`.

---

## Execution Order & Dependencies

```
WP01 (Foundation)
  └── WP02 (Shell & Routing)
  │     └── WP07 (Credit/Debit Pages)
  │     └── WP08 (Categories Pages)
  │     └── WP10 (Conciliation)
  │     └── WP11 (Recurrent Transactions)
  │     └── WP12 (Explorer)
  │     └── WP13 (Dashboards)
  │     └── WP14 (Settings)
  └── WP03 (Shared Components)
  └── WP04 (Services: Accounts)
  └── WP05 (Services: Transactions & Categories)
  └── WP06 (Business Logic Services)
        └── WP09 (Import Wizard)  ← needs WP04 + WP05 + WP06
```

**Parallelizable after WP01 completes:** WP02, WP03, WP04, WP05, WP06 can all run in parallel.

**Parallelizable after WP02+WP03+WP04+WP05+WP06 complete:** WP07–WP14 can all run in parallel.

---

## Work Package Summary

| File | Scope | Depends on |
|---|---|---|
| [WP01-foundation.md](WP01-foundation.md) | Models, StorageService, SettingsService, install xlsx | — |
| [WP02-shell-routing.md](WP02-shell-routing.md) | App shell layout, sidenav, all lazy routes | WP01 |
| [WP03-shared-components.md](WP03-shared-components.md) | ConfirmDialog, AmountDisplay, CurrencyPenPipe, StorageWarningBanner | WP01 |
| [WP04-services-accounts.md](WP04-services-accounts.md) | CreditCardService, DebitAccountService, ImportBatchService | WP01 |
| [WP05-services-transactions-categories.md](WP05-services-transactions-categories.md) | TransactionService, CategoryService, DuplicationCollectionService, RecurrentTransactionService, ConciliationService | WP01 |
| [WP06-business-logic-services.md](WP06-business-logic-services.md) | ExcelParserService, DuplicationLogicService, CategoryMatchingService, ConciliationCalculatorService, RecurrentMatchingService, DashboardCalculatorService | WP01 |
| [WP07-credit-debit-pages.md](WP07-credit-debit-pages.md) | Credit card list/form, debit account list/form | WP01–WP05 |
| [WP08-categories-pages.md](WP08-categories-pages.md) | Category list, rules list (drag-reorder), duplication collections | WP01–WP05 |
| [WP09-import-wizard.md](WP09-import-wizard.md) | 3-step import wizard with state, guard, duplication review | WP01–WP06 |
| [WP10-conciliation.md](WP10-conciliation.md) | Conciliation form + history | WP01–WP06 |
| [WP11-recurrent-transactions.md](WP11-recurrent-transactions.md) | Recurrent list, form, dashboard | WP01–WP06 |
| [WP12-explorer.md](WP12-explorer.md) | Transaction explorer with filters | WP01–WP05 |
| [WP13-dashboards.md](WP13-dashboards.md) | Monthly dashboard + cycle dashboard | WP01–WP06 |
| [WP14-settings.md](WP14-settings.md) | App settings page (P2 toggle) | WP01–WP02 |

---

## Global Coding Rules (apply to every WP)

1. **No standalone components.** Every component has `standalone: false` and is declared in its feature NgModule.
2. **OnPush everywhere.** Every component: `changeDetection: ChangeDetectionStrategy.OnPush`.
3. **Async pipe for all observables.** Never `.subscribe()` in components without unsubscribing; prefer `async` pipe.
4. **No comments unless non-obvious.** Follow the spec file's naming conventions exactly.
5. **Hungarian-prefixed fields** match the spec: `str*`, `dec*`, `int*`, `bool*`, `date*`.
6. **Material 19.** Import individual Angular Material modules in each feature module (MatButtonModule, MatFormFieldModule, etc.). Do not import MaterialModule globally.
7. **Tailwind for layout/spacing.** Angular Material for interactive components (buttons, inputs, dialogs, cards).
8. **Dates as `YYYY-MM-DD` strings** everywhere in stored data. Use `DatePipe` with format `'dd/MM/yyyy'` for display.
9. **No `.spec.ts` test files** — skip generating tests.
