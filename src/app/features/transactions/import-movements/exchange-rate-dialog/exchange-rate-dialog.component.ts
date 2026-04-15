import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SharedModule } from '../../../../shared/shared.module';

@Component({
  selector: 'app-exchange-rate-dialog',
  templateUrl: './exchange-rate-dialog.component.html',
  standalone: true,
  imports: [SharedModule]
})
export class ExchangeRateDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ExchangeRateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { sourceName: string }
  ) {
    this.form = this.fb.group({
      rate: [null, [Validators.required, Validators.min(0.0001)]]
    });
  }

  onSave(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value.rate as number);
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
