import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-checkpoint-dialog',
  templateUrl: './checkpoint-dialog.component.html',
  standalone: false
})
export class CheckpointDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CheckpointDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { entity: any, type: 'account' | 'card' }
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      balance: [this.data.entity.currentBalance || 0, Validators.required]
    });
  }

  onSave(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value.balance);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
