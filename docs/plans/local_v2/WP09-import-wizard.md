# WP09 — Import Wizard (3-Step)

**Depends on:** WP01, WP02, WP03, WP04, WP05, WP06  
**Spec:** DESIGN_LOCAL_v5.md §9; BUSINESS_LOGIC_v2.md §2, §8, §9

---

## Goal

Replace the import stub module with the full 3-step import wizard: Upload → Review → Finalize. No localStorage writes until Step 3 confirmation. The wizard uses an in-memory state service shared across the three step components.

---

## `ImportModule`

File: `src/app/features/import/import.module.ts`

Routes:
```
''          → ImportWizardComponent (the stepper wrapper)
'review'    → StepReviewComponent
'finalize'  → StepFinalizeComponent
```

Or alternatively, use `MatStepper` inside `ImportWizardComponent` with the three steps as child components loaded via `<ng-template matStepContent>`. Either approach is acceptable — the stepper approach (single route, MatStepper with three steps) is simpler and recommended.

**Recommended: single-component stepper approach**
- Route: `''` → `ImportWizardComponent`
- `ImportWizardComponent` hosts a `<mat-stepper linear>` with three `<mat-step>` sections.
- Each step's content is a separate component (`StepUploadComponent`, `StepReviewComponent`, `StepFinalizeComponent`) projected via `<ng-template matStepContent>`.

Import in NgModule: `SharedModule`, `ReactiveFormsModule`, `MatStepperModule`, `MatFormFieldModule`, `MatInputModule`, `MatSelectModule`, `MatOptionModule`, `MatCheckboxModule`, `MatIconModule`, `MatChipsModule`, `MatMenuModule`, `MatProgressSpinnerModule`, `MatDividerModule`.

---

## Wizard State Service

File: `src/app/features/import/state/import-wizard-state.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AccountType } from '../../../core/models/transaction.model';
import { AnnotatedImportRow } from '../../../core/services/duplication-logic.service';

export interface ImportWizardState {
  accountId: string | null;
  accountType: AccountType | null;
  currentBalance: number | null;
  usdExchangeRate: number | null;
  annotatedRows: AnnotatedImportRow[];
  contextTransactionIds: string[];
  pendingDeletions: string[];
}

const INITIAL_STATE: ImportWizardState = {
  accountId: null,
  accountType: null,
  currentBalance: null,
  usdExchangeRate: null,
  annotatedRows: [],
  contextTransactionIds: [],
  pendingDeletions: [],
};

@Injectable({ providedIn: 'root' })
export class ImportWizardStateService {
  private readonly _state$ = new BehaviorSubject<ImportWizardState>({ ...INITIAL_STATE });
  readonly state$ = this._state$.asObservable();

  getState(): ImportWizardState { return this._state$.getValue(); }

  patch(partial: Partial<ImportWizardState>): void {
    this._state$.next({ ...this.getState(), ...partial });
  }

  reset(): void {
    this._state$.next({ ...INITIAL_STATE });
  }
}
```

---

## `ImportWizardGuard` (CanDeactivate)

File: `src/app/features/import/guards/import-wizard.guard.ts`

```typescript
import { Injectable } from '@angular/core';
import { CanDeactivate } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs/operators';
import { ImportWizardComponent } from '../pages/import-wizard/import-wizard.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ImportWizardStateService } from '../state/import-wizard-state.service';

@Injectable({ providedIn: 'root' })
export class ImportWizardGuard implements CanDeactivate<ImportWizardComponent> {
  constructor(
    private stateService: ImportWizardStateService,
    private dialog: MatDialog
  ) {}

  canDeactivate() {
    const state = this.stateService.getState();
    if (state.annotatedRows.length === 0) return true;

    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        data: {
          title: 'Leave import?',
          message: 'You have an import in progress. Leaving will discard your progress.',
          confirmLabel: 'Leave',
          danger: true,
        },
      }
    );
    return ref.afterClosed().pipe(map(result => {
      if (result) this.stateService.reset();
      return !!result;
    }));
  }
}
```

Apply this guard to the import route in `ImportModule`.

---

## `ImportWizardComponent` (the stepper wrapper)

Files:
- `src/app/features/import/pages/import-wizard/import-wizard.component.ts`
- `src/app/features/import/pages/import-wizard/import-wizard.component.html`

Simple component that holds `<mat-stepper linear #stepper>`. Provides `stepper` via ViewChild to child components so they can call `stepper.next()` / `stepper.previous()`.

```html
<div class="max-w-5xl mx-auto p-4">
  <h1 class="text-2xl font-semibold mb-4">Import Transactions</h1>
  <mat-stepper linear #stepper>
    <mat-step label="Upload">
      <ng-template matStepContent>
        <app-step-upload [stepper]="stepper"></app-step-upload>
      </ng-template>
    </mat-step>
    <mat-step label="Review">
      <ng-template matStepContent>
        <app-step-review [stepper]="stepper"></app-step-review>
      </ng-template>
    </mat-step>
    <mat-step label="Finalize">
      <ng-template matStepContent>
        <app-step-finalize [stepper]="stepper"></app-step-finalize>
      </ng-template>
    </mat-step>
  </mat-stepper>
</div>
```

---

## `StepUploadComponent`

Spec: DESIGN_LOCAL_v5.md §9 Step 1; BUSINESS_LOGIC_v2.md §8.1

**Inputs:** `@Input() stepper: MatStepper`

**Inject:** `CreditCardService`, `DebitAccountService`, `ImportBatchService`, `TransactionService`, `CategoryService`, `DuplicationCollectionService`, `SettingsService`, `ExcelParserService`, `DuplicationLogicService`, `CategoryMatchingService`, `ImportWizardStateService`, `SnackbarService`

**Reactive form:**
```typescript
form = new FormGroup({
  accountId:       new FormControl<string|null>(null, Validators.required),
  currentBalance:  new FormControl<number|null>(null, [Validators.required, Validators.min(0)]),
  usdExchangeRate: new FormControl<number>(1.00, [Validators.required, Validators.min(0.01)]),
});
```

**State fields:**
```typescript
selectedFile: File | null = null;
fileError: string | null = null;
isLoading = false;
hasUsdRows = false;
hasMultipleSheets = false;
```

**Account selector:** `<mat-select>` with two `<mat-optgroup>`: "Credit Cards" (from `creditCardService.getAll()`) and "Debit Accounts" (from `debitAccountService.getAll()`). On selection, store `accountId` and determine `accountType`.

**File input:**
```html
<input type="file" accept=".xlsx" (change)="onFileSelect($event)" #fileInput>
```

On file select: immediately validate extension (`.xlsx`) and size (`<= 10 MB`). Set `fileError` if invalid.

**Exchange rate field:** always visible. Required with `Validators.min(0.01)` only when `hasUsdRows === true`; otherwise just shown with no validation enforcement.

**On "Next" button click:**
1. Mark form dirty/touched, validate.
2. Show `MatProgressSpinner` — set `isLoading = true`.
3. `await excelParserService.parseFile(file, usdExchangeRate)` — catch `ParseValidationError`, show error, set `isLoading = false`, return.
4. If `rows.length === 0`: show error "No valid rows found — check file format"; return.
5. If `hasMultipleSheets`: show info banner.
6. Run duplication annotation: `duplicationLogicService.annotate(rows, transactionService.getAll(), collectionService.getAll(), accountId, accountType, settingsService.getSettings().boolP2RuleEnabled)`.
7. Run category matching: for each row, call `categoryMatchingService.match(row.description, categoryService.getRules())`.
8. Compute context transactions: find the earliest `dateTransaction` in rows; filter `transactionService.getActive()` where `accountId === selectedAccountId` and `dateTransaction` in `[earliestDate - 5 days, earliestDate - 1 day]`.
9. `importWizardStateService.patch({ accountId, accountType, currentBalance, usdExchangeRate, annotatedRows: annotatedWithCategories, contextTransactionIds: contextTxns.map(t => t.id), pendingDeletions: [] })`.
10. `isLoading = false`.
11. `stepper.next()`.

---

## `StepReviewComponent`

Spec: DESIGN_LOCAL_v5.md §9 Step 2; BUSINESS_LOGIC_v2.md §8.2

**Inputs:** `@Input() stepper: MatStepper`

**Inject:** `ImportWizardStateService`, `TransactionService`

**Local state:**
- `rows: AnnotatedImportRow[]` — copy from wizard state, mutable.
- `contextTransactions: Transaction[]` — resolved from state's `contextTransactionIds`.
- `pendingDeletions: Set<string>`.

**Display:**
- Group rows by `dateTransaction` DESC.
- `AUTO_DUPLICATE` rows: `mat-checkbox` unchecked + `[disabled]` + gray opacity.
- Banner when ALL rows are AUTO_DUPLICATE: amber info bar.
- `POTENTIAL_DUPLICATE` rows: yellow/amber highlighted background. Show the matching transaction as a sub-row below (description, date, amount).
- P2-flagged rows (P2 annotation — see below): add a small chip/badge "P2" with `matTooltip="Same amount ±3 days (opt-in rule)"`.

**P2 badge detection:** A `POTENTIAL_DUPLICATE` row where the match was found by Rule P2 (only amount + date match, no prefix match). To track this, add an optional `matchRule?: 'P1'|'P2'|'P3'` field to `AnnotatedImportRow`. Update `DuplicationLogicService` to set this when applicable.

**Row actions (mat-menu context menu per row):**
- "Add note": opens an inline text input below the row.
- "Mark as Pending": sets `row.pendingFlag = true`; shows a PENDING chip on the row.

**Context transactions panel** (shown below the import rows, separated by a divider):
- Title: *"Transactions in the 5 days before this import"*
- Each context transaction row: date, description, amount + trash icon.
- Clicking trash: add to `pendingDeletions` set; show row struck-through.
- Clicking again: remove from `pendingDeletions`; restore row display.

**"← Back" button:** call `importWizardStateService.reset()`; `stepper.previous()`.

**"Next →" button:**
1. Apply pending deletions: `for (id of pendingDeletions) transactionService.softDelete(id)`.
2. `importWizardStateService.patch({ annotatedRows: rows, pendingDeletions: [...pendingDeletions] })`.
3. `stepper.next()`.

---

## `StepFinalizeComponent`

Spec: DESIGN_LOCAL_v5.md §9 Step 3; BUSINESS_LOGIC_v2.md §8.3

**Inputs:** `@Input() stepper: MatStepper`

**Inject:** `ImportWizardStateService`, `CreditCardService`, `DebitAccountService`, `TransactionService`, `ImportBatchService`, `RecurrentTransactionService`, `CategoryMatchingService`, `MatDialog`, `Router`, `SnackbarService`, `StorageService`

**Display (read-only summary):**
```
Account:           [account name]
Transactions:      N to import (M auto-duplicates skipped)
Exchange rate:     S/ 3.75 per USD
Pending:           P transactions marked as pending
```

**"Save & Finish" button:**

1. Open confirm dialog: `"Import N transactions into [Account Name]? This cannot be undone."` — on cancel, stop.

2. Try block:
```typescript
try {
  const state = importWizardStateService.getState();
  const checkedRows = state.annotatedRows.filter(r => r.checked);

  const batch = importBatchService.save({
    accountId: state.accountId!,
    accountType: state.accountType!,
    dateImport: new Date().toISOString().slice(0, 10),
    decUsdExchangeRate: state.usdExchangeRate!,
    decBalanceAtImport: state.accountType === 'CREDIT_CARD'
      ? -Math.abs(state.currentBalance!)
      : Math.abs(state.currentBalance!),
  });

  transactionService.saveMany(checkedRows.map(row => ({
    accountId: state.accountId!,
    accountType: state.accountType!,
    importBatchId: batch.id,
    dateTransaction:    row.raw.dateTransaction,
    strDescription:     row.raw.description,
    strCurrency:        row.raw.currency,
    decAmount:          row.raw.amount,
    decAmountPen:       row.raw.amountPen,
    subcategoryId:      row.subcategoryId,
    strNotes:           row.note,
    strOperationNumber: row.raw.strOperationNumber,
    strStatus:          row.pendingFlag ? 'PENDING' : 'ACTIVE',
  })));

  // Automatic recurrent matching
  const recurrents     = recurrentTransactionService.getAll();
  const existingMatches = recurrentTransactionService.getAllMatches();
  const allActive      = transactionService.getActive();
  const todayDate      = new Date().toISOString().slice(0, 10);
  const newMatches = recurrentMatchingService.findAutomaticMatches(
    recurrents, existingMatches, allActive, todayDate
  );
  for (const result of newMatches) {
    recurrentTransactionService.saveMatch({
      recurrentTransactionId: result.recurrent.id,
      strIterationKey: result.iterationKey,
      transactionId: result.transaction.id,
      boolDone: true,
      dateDone: todayDate,
      strMatchMode: 'AUTOMATIC',
    });
  }

  // Storage check
  const WARN_THRESHOLD = 4 * 1024 * 1024;
  if (storageService.getTotalBytes() > WARN_THRESHOLD) {
    snackbar.info('Storage is nearly full (>4 MB). Consider removing old data.');
  }

  importWizardStateService.reset();
  snackbar.success(`Import complete — ${checkedRows.length} transactions saved.`);

  if (state.accountType === 'CREDIT_CARD') {
    router.navigate(['/conciliation']);
  } else {
    router.navigate(['/transactions']);
  }
} catch (err) {
  if (err instanceof StorageWriteError) {
    snackbar.error('Save failed — storage quota exceeded. No data was written.');
  } else {
    throw err;
  }
}
```

---

## `RecurrentMatchingService.findAutomaticMatches` signature

This service (from WP06) must expose:
```typescript
findAutomaticMatches(
  recurrents: RecurrentTransaction[],
  existingMatches: RecurrentTransactionMatch[],
  activeTransactions: Transaction[],
  todayDate: string
): Array<{ recurrent: RecurrentTransaction; transaction: Transaction; iterationKey: string }>
```

---

## Acceptance Criteria

- Step 1: file extension and size validation blocks non-.xlsx and >10MB files.
- Step 1: exchange rate field required only when `hasUsdRows === true`.
- Step 1: USD rows compute `amountPen = amount × usdExchangeRate` at parse time.
- Step 2: AUTO_DUPLICATE rows are unchecked + disabled.
- Step 2: trash icon on context transactions marks them for deletion without writing localStorage.
- Step 2: "← Back" resets state and returns to step 1.
- Step 3: confirm dialog appears before any write; canceling produces no side effects.
- Step 3: `StorageWriteError` shows error toast; no navigation occurs.
- Step 3: success → credit card accounts navigate to `/conciliation`; debit accounts to `/transactions`.
- CanDeactivate guard fires when navigating away with annotatedRows present.
