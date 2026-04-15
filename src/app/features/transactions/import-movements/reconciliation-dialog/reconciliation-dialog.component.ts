import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ReconciliationDialogData {
  accountName: string;
  previousOwedAmount: number;
  previousSnapshotDate: Date;
  importedMovementsTotal: number;
  expectedCurrentOwed: number;
  currentOwedAmount: number;
  delta: number;
}

@Component({
  selector: 'app-reconciliation-dialog',
  templateUrl: './reconciliation-dialog.component.html',
  standalone: false
})
export class ReconciliationDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ReconciliationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReconciliationDialogData
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
