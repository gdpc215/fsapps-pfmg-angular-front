import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ReconciliationConfirmDialogData {
  accountName: string;
  previousOwedAmount: number;
  previousSnapshotDate: Date;
  movementsTotal: number;
  expectedCurrentOwed: number;
  currentOwedAmount: number;
  delta: number;
}

@Component({
  selector: 'app-reconciliation-confirm-dialog',
  templateUrl: './reconciliation-confirm-dialog.component.html',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, DecimalPipe, DatePipe]
})
export class ReconciliationConfirmDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ReconciliationConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReconciliationConfirmDialogData
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
