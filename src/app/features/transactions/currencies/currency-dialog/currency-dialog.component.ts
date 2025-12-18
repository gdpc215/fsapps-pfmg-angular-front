import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Currency } from '../../../../logic/types/currency';

@Component({
  selector: 'app-currency-dialog',
  templateUrl: './currency-dialog.component.html',
  standalone: false
})
export class CurrencyDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CurrencyDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { currency: Currency | null }
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      code: [this.data.currency?.code || '', Validators.required],
      symbol: [this.data.currency?.symbol || '', Validators.required],
      name: [this.data.currency?.name || '', Validators.required]
    });
  }

  onSave(): void {
    if (this.form.valid) {
      const currency = new Currency();
      if (this.data.currency) {
        currency.id = this.data.currency.id;
      }
      currency.code = this.form.value.code;
      currency.symbol = this.form.value.symbol;
      currency.name = this.form.value.name;
      this.dialogRef.close(currency);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
