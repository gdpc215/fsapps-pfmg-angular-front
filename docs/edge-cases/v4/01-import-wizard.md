# Edge Cases — Import Wizard (3-Step Flow)

Design ref: DESIGN_LOCAL_v4.md §9, BUSINESS_LOGIC.md §8–§9

---

## Step 1 — Upload

### File validation
- **No file-type guard.** The input accepts any file; if the user selects a `.csv` or non-Excel file, SheetJS will throw an unhandled error. Guard should check `file.name.endsWith('.xlsx')` (and optionally MIME type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) before calling `parseFile`.
- **No file-size limit.** A user could accidentally drag in a 500 MB file. SheetJS reads the entire buffer into memory. Set a hard cap (e.g., 10 MB) and show a friendly error before `arrayBuffer()` is called.
- **Multi-sheet workbooks.** `ExcelParserService` always reads `SheetNames[0]`. Bank exports occasionally have a cover sheet first (summary, disclaimers). If the data is on sheet 2 the import silently returns 0 rows. Add a sheet selector or at least a warning when `SheetNames.length > 1`.

### Date parsing
- **Non-ISO text dates.** The fallback path `new Date(value)` in `parseDate()` relies on browser locale parsing. `"15/05/2026"` (DD/MM/YYYY, common in Peruvian bank exports) is parsed as `NaN` in most environments. Add explicit format detection (SheetJS `cellDates: true` usually handles this if the cell is actually a Date cell, but text cells are risky).
- **Timezone shift.** `new Date(dateString).toISOString()` converts to UTC, which can shift the date by one day for users in UTC−5 (Peru). Use `date.toLocaleDateString('en-CA')` or parse to avoid the timezone flip when the source is already local time.

### Amount/currency parsing
- **`Number(r[COL_MONTO])` on non-numeric cells** returns `NaN` — a NaN amount will pass the row filter (null check only) and be stored as `NaN` in localStorage, breaking all balance calculations downstream.
- **Thousands-separator strings.** Some bank exports format amounts as `"1,250.50"` — `Number("1,250.50")` returns `NaN`. Strip commas before conversion.

### Exchange-rate edge cases
- **Rate = 0.** `amountPen = amount * 0 = 0` for all USD rows — no error is shown, but all USD amounts become invisible in dashboards. Validate `usdExchangeRate > 0`.
- **Rate not entered (null).** If the field is optional and left blank when there are USD rows, `amountPen = amount * null = 0`. Field should be required when the imported file contains USD rows (detectable after parse), or always required.

### Empty parse result
- **0 valid rows after filtering.** The wizard navigates to Step 2 with an empty `annotatedRows[]`. Step 2 shows nothing; the user can "Next" to Step 3 and "Save & Finish" which writes an `ImportBatch` with 0 transactions. Guard: disable "Next" in Step 1 if parse result is empty, or show a "No rows found — check file format" error.

---

## Step 2 — Review

### State persistence across navigation
- **Browser refresh wipes wizard state.** `ImportWizardStateService` is a `BehaviorSubject` in memory — a page refresh resets to `INITIAL`. The user loses all wizard progress. Either persist state to `sessionStorage` or show a route guard warning ("Leaving this page will reset the wizard").
- **Browser back-button from Step 2 to Step 1.** The Angular router navigates back but Step 1 re-renders with its default form values, while `ImportWizardStateService` still holds the old parse result. If the user re-parses a new file, the patch overwrites state correctly; but if they click "Next" without re-parsing, they return to Step 2 with stale data.

### Soft-delete on context transactions is permanent
- **No undo.** Deleting a context transaction via the trash icon in Step 2 is the only **real localStorage write** in Steps 1–2 and cannot be reversed from within the wizard. The user may accidentally delete a valid transaction. Add a confirmation or an undo snackbar (e.g., 5-second undo toast before the delete is permanent).

### All rows AUTO_DUPLICATE
- If every incoming row is AUTO_DUPLICATE, Step 2 shows only disabled/grayed rows and context transactions. There is no message explaining why nothing is checked. Add an info banner: "All X rows were detected as duplicates and will be skipped."

### Aggressive P2 rule
- Rule P2 flags `POTENTIAL_DUPLICATE` for any row with the same amount within ±3 days, regardless of description. For common round amounts (e.g., 50 PEN bus fare) this produces many false positives. The user must manually review each one. Consider making P2 opt-in or showing a count of P2 matches so the user understands why so many rows are highlighted.

### Missing subcategory change persistence
- The design states that subcategory selectors per row are shown in Step 2. If the user changes a subcategory and immediately clicks "Next →", the change must be committed from the DOM to `ImportWizardStateService` before navigation. If persistence relies on an `(change)` event that fires after blur, rapidly clicking "Next" could lose the last change. The "Next" handler should call `patch()` with all current row states, not rely on individual row-level events.

---

## Step 3 — Finalize

### localStorage write failure (QuotaExceededError)
- `StorageService.persist()` calls `localStorage.setItem()` with no error handling. If the browser's quota is exceeded, `setItem` throws `QuotaExceededError`. The app will crash mid-save — `pfmg_import_batches` may be written, `pfmg_transactions` may not. This leaves a dangling `ImportBatch` with no transactions. Wrap `persist()` in a try-catch; on failure, roll back the batch record and show an error.

### Partial recurrent-matching failure
- Step 3d loops through `newMatches` and saves each with individual `saveMatch()` calls. If the app crashes or the user closes the tab between saves, some matches are written and others are not. On next import, the `alreadyMatched` guard prevents double-matching for the ones that succeeded, but the user won't know which recurrents were matched. This is hard to avoid without transactions (in the DB sense) in localStorage, but documenting the risk is important.

### No confirmation before "Save & Finish"
- "Save & Finish" is an irreversible commit. There is no confirmation dialog. A user who clicks it by mistake cannot undo. Add a `MatDialog` confirm: "You are about to import N transactions. This cannot be undone. Continue?"

### Balance sign for debit accounts
- Step 3 stores `decBalanceAtImport = currentBalance` (positive) for debit accounts. But if a debit account has a negative balance (overdraft), the user would enter a negative number — and the system stores it as-is. No validation that debit balances are positive; no sign guidance in the UI.

### Post-import navigation
- After successful save, the wizard navigates to `ROUTES.CONCILIATION`. This is the credit-card conciliation page. For a **debit account import**, this page is irrelevant. Route after import should depend on `accountType`: credit card → conciliation; debit account → transaction list for that account.
