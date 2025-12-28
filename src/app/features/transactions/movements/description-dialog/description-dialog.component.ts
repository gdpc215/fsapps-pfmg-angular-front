import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface AdditionalInfoDialogData {
  additionalInfo: string;
}

@Component({
  selector: 'app-description-dialog',
  templateUrl: './description-dialog.component.html',
  standalone: false
})
export class DescriptionDialogComponent {
  additionalInfo: string;

  constructor(
    public dialogRef: MatDialogRef<DescriptionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AdditionalInfoDialogData
  ) {
    this.additionalInfo = data.additionalInfo || '';
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close(this.additionalInfo);
  }
}
