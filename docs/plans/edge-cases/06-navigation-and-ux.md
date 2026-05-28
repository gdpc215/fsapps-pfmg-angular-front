# Edge Cases — Navigation and UX Improvements

Design ref: DESIGN_LOCAL_v4.md §8 (component structure), §9–§14 (UI flows)

---

## Wizard Navigation

### No route guard on import wizard
- Navigating away from the import wizard (using the sidenav, browser back, or any link) silently resets `ImportWizardStateService` on the next visit. The user loses their parsed rows, subcategory assignments, and pending flags without warning.
- **Fix:** Add a `CanDeactivate` route guard on `ImportWizardComponent`. If `state.annotatedRows.length > 0`, show a `MatDialog` confirm: "You have an import in progress. Leaving will discard your changes. Are you sure?"

### Step navigation without stepper breadcrumbs
- The 3-step wizard (Upload → Review → Finalize) uses three separate route-navigated components. There is no `MatStepper` or breadcrumb showing "Step 2 of 3 — Review". The user has no visual progress indicator.
- **Fix:** Use Angular Material's `MatStepperModule` for a visual stepper header (step titles + completion indicators), or render a custom breadcrumb `Step 1 > Step 2 > Step 3` in the wizard shell component.

### Back button in Step 2 / Step 3
- The spec describes navigating forward with "Next" but does not define a "Back" button. Without a back button, the user must use the browser's back button. If Step 1's state persists correctly in `ImportWizardStateService`, this works — but the route-level state (file object, Form values) is lost. Add explicit "← Back" buttons that navigate to the previous step and restore the form from state.

---

## Destructive Action Confirmations

### No confirmation on "Save & Finish" (import Step 3)
- The "Save & Finish" button commits N transactions and is irreversible. Add a confirm dialog: "Import X transactions into [Account Name]? This cannot be undone."

### No confirmation on soft-delete in Step 2 context transactions
- The trash icon on context transactions in Step 2 soft-deletes immediately (the only write in Steps 1–2). Add a brief undo snackbar ("Transaction deleted — Undo" with a 5-second window).

### No confirmation on card/account deletion
- `CreditCardService.delete()` and `DebitAccountService.delete()` execute immediately via a button click. No dialog asks "Are you sure?". This leaves orphaned transactions (see data-integrity.md). Add a `MatDialog` confirm with a cascade summary.

### No confirmation on category/subcategory deletion
- Same issue. Particularly dangerous since deleting a subcategory orphans transaction references silently.

---

## Post-Action Feedback

### No success toast after import
- After "Save & Finish", the wizard resets and navigates to conciliation. There is no "Import successful: 47 transactions saved" confirmation. A `MatSnackBar` toast for 5 seconds gives the user confidence the action completed.

### No success toast after conciliation confirm
- Same pattern. After saving a `CycleClose`, a toast "Cycle closed. Interest recorded: 12.50 PEN" would summarize the result.

### No success toast after recurrent match actions
- "Mark as done" and "Link transaction" write silently. A small toast or a visual row-state transition (badge turns green) provides confirmation.

---

## Sidenav and Active Route

### Active route not highlighted in sidenav
- The spec describes a sidenav (`SidenavComponent`) but does not specify active-route highlighting. Use `routerLinkActive="active"` on sidenav links and style the active link distinctly (e.g., accent background or left border).

### Sidenav collapse on mobile / small screens
- The design uses Angular Material's sidenav but doesn't specify behavior on small screens. A `mat-sidenav` in `side` mode is permanently visible. On mobile, it should switch to `over` mode (overlaid, closed by default). Use `BreakpointObserver` to toggle the mode.

### No keyboard shortcut for sidenav toggle
- Power users benefit from a shortcut (e.g., `Alt+M`) to open/close the sidenav. Angular Material's sidenav exposes a `MatSidenavContainer` with a `toggle()` method — bind it to a global `(keydown)` listener on the shell component.

---

## Empty States

### Credit card list: no cards added yet
- First-time users see a blank list. Add an empty state card: "No credit cards yet. Add your first card →" with a button linking to the create form.

### Transaction list: no transactions yet
- First-time users (or after clearing storage) see a blank table. Add: "No transactions found. Start by importing an Excel file →".

### Conciliation history: no cycle closes yet
- The history page is the post-import redirect destination but may be empty on first use. Show: "No cycle closes recorded yet. Run a conciliation to start tracking cycles."

### Recurrent dashboard: no recurrents configured
- Show: "No recurring transactions configured. Add them in Recurrent Transactions →".

---

## General UX Improvements

### Account selector in import wizard: mixed credit/debit list
- The `<mat-select>` in Step 1 mixes credit cards and debit accounts. With many accounts the list becomes long with no grouping. Use `<mat-optgroup>` with labels "Credit Cards" and "Debit Accounts" to visually separate them.

### Amount display consistency
- The spec mentions an `AmountDisplayComponent` and a `CurrencyPenPipe`. Ensure all monetary values throughout the app use the same pipe — inconsistent formatting (some show "S/ 1,250.50", others "1250.5") erodes trust in a financial app.

### Date format consistency
- Dates stored as `YYYY-MM-DD` strings should always be displayed in a locale-appropriate format (e.g., "15/05/2026" or "May 15, 2026"). Use a single `DatePipe` with a consistent format token everywhere. Raw `YYYY-MM-DD` strings in the UI look like data, not dates.

### Loading indicator during file parse
- `ExcelParserService.parseFile()` is an `async` function that calls `file.arrayBuffer()` and runs SheetJS. For large files this can take 1–2 seconds. Show a `MatProgressSpinner` or disable the "Next" button with a spinner while parsing. Without feedback, users may click "Next" repeatedly thinking the first click didn't register.

### Transaction list: no account filter
- `TransactionService.getByCard(cardId)` exists but the transaction list page's filter capabilities are not specified. At minimum, allow filtering by account. Also: filtering by status (ACTIVE/PENDING), date range, and amount range are standard for a finance app.

### No keyboard navigation in tables
- Standard accessibility: data tables should support `Tab` to move between rows and `Enter`/`Space` to activate a row's primary action. Angular Material's `MatTable` doesn't add this by default. Use `matRipple` and `tabindex="0"` on rows.

### No export / backup feature
- Users cannot back up their data. A "Export all data as JSON" and "Import from backup JSON" would prevent total data loss from accidental `localStorage.clear()` or switching browsers/devices.

### Category rule drag-to-reorder accessibility
- BUSINESS_LOGIC.md §3.6 mentions a "bulk drag-to-reorder interface" for category rules. Drag-and-drop is not accessible for keyboard-only users. Add up/down arrow buttons or a priority number input as an alternative.
