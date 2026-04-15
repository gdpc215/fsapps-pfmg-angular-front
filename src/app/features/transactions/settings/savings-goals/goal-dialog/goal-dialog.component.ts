import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SavingsGoal } from '../../../../../logic/types/savings-goal';
import { SharedModule } from '../../../../../shared/shared.module';

@Component({
  selector: 'app-goal-dialog',
  templateUrl: './goal-dialog.component.html',
  standalone: true,
  imports: [SharedModule]
})
export class GoalDialogComponent {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<GoalDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { goal: SavingsGoal | null }
  ) {
    this.form = this.fb.group({
      name: [data.goal?.name ?? '', Validators.required],
      targetAmount: [data.goal?.targetAmount ?? null, [Validators.required, Validators.min(0.01)]]
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
