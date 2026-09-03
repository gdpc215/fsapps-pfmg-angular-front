# WP03 — Shared Components, Pipes & Dialogs

**Depends on:** WP01  
**Spec:** DESIGN_LOCAL_v5.md §8 (shared/ directory)

---

## Goal

Build the reusable UI building blocks used across all features: `ConfirmDialogComponent`, `AmountDisplayComponent`, and `CurrencyPenPipe`. Update `SharedModule` to export all of them so feature modules can import `SharedModule` to get everything.

---

## Step 1 — `CurrencyPenPipe`

File: `src/app/shared/pipes/currency-pen.pipe.ts`

Formats a number as Peruvian sol currency for display (e.g., `S/ 1,250.50`). Negative amounts render in red via CSS class — this pipe should return a formatted string only; color is applied by the component/template.

```typescript
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'currencyPen', standalone: false })
export class CurrencyPenPipe implements PipeTransform {
  transform(value: number | null | undefined, showSign = false): string {
    if (value == null) return 'S/ 0.00';
    const formatted = Math.abs(value).toLocaleString('es-PE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const prefix = showSign && value < 0 ? '−' : '';
    return `${prefix}S/ ${formatted}`;
  }
}
```

---

## Step 2 — `AmountDisplayComponent`

File: `src/app/shared/components/amount-display/amount-display.component.ts`

Inline component that displays an amount with automatic red/green color based on sign.

```typescript
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-amount-display',
  standalone: false,
  template: `
    <span [class.text-red-600]="value < 0" [class.text-green-600]="value > 0">
      {{ value | currencyPen:true }}
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmountDisplayComponent {
  @Input() value: number = 0;
}
```

This component needs `CurrencyPenPipe` available in the same module — ensure `SharedModule` provides it.

---

## Step 3 — `ConfirmDialogComponent`

Files:
- `src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`
- `src/app/shared/components/confirm-dialog/confirm-dialog.component.html`

Generic `MatDialog` confirm used throughout the app.

### Interface for dialog data

```typescript
export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;   // default: 'Confirm'
  cancelLabel?: string;    // default: 'Cancel'
  danger?: boolean;        // true = confirm button styled as mat-warn
}
```

### Component

```typescript
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-dialog',
  standalone: false,
  templateUrl: './confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  confirm(): void { this.dialogRef.close(true); }
  cancel(): void  { this.dialogRef.close(false); }
}
```

### Template

```html
<h2 mat-dialog-title>{{ data.title }}</h2>
<mat-dialog-content>
  <p class="whitespace-pre-line">{{ data.message }}</p>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="cancel()">{{ data.cancelLabel ?? 'Cancel' }}</button>
  <button mat-button
    [color]="data.danger ? 'warn' : 'primary'"
    (click)="confirm()">
    {{ data.confirmLabel ?? 'Confirm' }}
  </button>
</mat-dialog-actions>
```

### Usage pattern (for feature components)

```typescript
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

// In a method:
const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
  ConfirmDialogComponent,
  { data: { title: 'Delete card?', message: 'This cannot be undone.', danger: true } }
);
ref.afterClosed().subscribe(confirmed => {
  if (confirmed) { /* proceed */ }
});
```

---

## Step 4 — Update `SharedModule`

File: `src/app/shared/shared.module.ts`

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';

import { CurrencyPenPipe } from './pipes/currency-pen.pipe';
import { AmountDisplayComponent } from './components/amount-display/amount-display.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';

const DECLARATIONS = [
  CurrencyPenPipe,
  AmountDisplayComponent,
  ConfirmDialogComponent,
];

const MATERIAL_MODULES = [
  MatButtonModule,
  MatDialogModule,
  MatSnackBarModule,
  MatProgressSpinnerModule,
  MatTooltipModule,
  MatBadgeModule,
];

@NgModule({
  declarations: DECLARATIONS,
  imports: [CommonModule, ...MATERIAL_MODULES],
  exports: [...DECLARATIONS, CommonModule, ...MATERIAL_MODULES],
})
export class SharedModule {}
```

**Note:** Feature modules import `SharedModule` to get access to `CurrencyPenPipe`, `AmountDisplayComponent`, `ConfirmDialogComponent`, and the common Material modules listed above. Feature-specific Material modules (MatTableModule, MatFormFieldModule, etc.) are still imported in each feature module individually.

---

## Step 5 — `MatSnackBar` helper

Add a private helper to avoid boilerplate in feature components. This goes in `SharedModule` as a simple injectable:

File: `src/app/shared/services/snackbar.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  constructor(private snackBar: MatSnackBar) {}

  success(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 3000, panelClass: ['snack-success'] });
  }

  error(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 5000, panelClass: ['snack-error'] });
  }

  info(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 4000 });
  }
}
```

Add global snackbar styles to `src/styles.scss` (or `src/styles.css`):
```css
.snack-success .mdc-snackbar__surface { background-color: #16a34a !important; }
.snack-error   .mdc-snackbar__surface { background-color: #dc2626 !important; }
```

---

## Acceptance Criteria

- `npm run build` passes.
- `CurrencyPenPipe` formats `1250.5` as `S/ 1,250.50` and `-350` with sign as `−S/ 350.00`.
- `AmountDisplayComponent` renders red for negative, green for positive values.
- `ConfirmDialogComponent` opens via `MatDialog`, returns `true` on confirm, `false`/`undefined` on cancel.
- `SharedModule` exports all three plus `CommonModule` so feature modules only need one import.
