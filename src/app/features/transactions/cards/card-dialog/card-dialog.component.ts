import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Card } from '../../../../logic/types/card';
import { Currency } from '../../../../logic/types/currency';

@Component({
  selector: 'app-card-dialog',
  templateUrl: './card-dialog.component.html',
  standalone: false
})
export class CardDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { card: Card | null, currencies: Currency[] }
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [this.data.card?.name || '', Validators.required],
      primaryCurrencyId: [this.data.card?.primaryCurrencyId || '', Validators.required],
      secondaryCurrencyId: [this.data.card?.secondaryCurrencyId || null],
      currentBalance: [this.data.card?.currentBalance || 0, Validators.required],
      interestDate: [this.data.card?.interestDate || 1, [Validators.required, Validators.min(1), Validators.max(31)]],
      paymentDate: [this.data.card?.paymentDate || 1, [Validators.required, Validators.min(1), Validators.max(31)]]
    });
  }

  onSave(): void {
    if (this.form.valid) {
      const card = new Card();
      if (this.data.card) {
        card.id = this.data.card.id;
        card.lastCheckpointBalance = this.data.card.lastCheckpointBalance;
        card.lastCheckpointDate = this.data.card.lastCheckpointDate;
      }
      card.name = this.form.value.name;
      card.primaryCurrencyId = this.form.value.primaryCurrencyId;
      card.secondaryCurrencyId = this.form.value.secondaryCurrencyId;
      card.currentBalance = this.form.value.currentBalance;
      card.interestDate = this.form.value.interestDate;
      card.paymentDate = this.form.value.paymentDate;
      this.dialogRef.close(card);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
