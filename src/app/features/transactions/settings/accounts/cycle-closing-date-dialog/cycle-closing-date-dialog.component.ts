import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SharedModule } from '../../../../../shared/shared.module';

@Component({
  selector: 'app-cycle-closing-date-dialog',
  templateUrl: './cycle-closing-date-dialog.component.html',
  standalone: true,
  imports: [SharedModule]
})
export class CycleClosingDateDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CycleClosingDateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { accountName: string }
  ) {
    this.form = this.fb.group({
      closingDate: [null, Validators.required]
    });
  }

  onSave(): void {
    if (this.form.valid) {
      const date: Date = this.form.value.closingDate;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      this.dialogRef.close(`${year}-${month}-${day}`);
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
