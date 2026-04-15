import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SharedModule } from '../../../../../shared/shared.module';

@Component({
  selector: 'app-contribution-dialog',
  templateUrl: './contribution-dialog.component.html',
  standalone: true,
  imports: [SharedModule]
})
export class ContributionDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ContributionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { goalName: string }
  ) {
    const today = new Date().toISOString().split('T')[0];
    this.form = this.fb.group({
      date: [today, Validators.required],
      amount: [null, [Validators.required, Validators.min(0.01)]]
    });
  }

  onSave(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
