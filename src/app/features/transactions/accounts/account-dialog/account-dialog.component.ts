import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Account } from '../../../../logic/types/account';
import { Currency } from '../../../../logic/types/currency';

@Component({
  selector: 'app-account-dialog',
  templateUrl: './account-dialog.component.html',
  standalone: false
})
export class AccountDialogComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AccountDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { account: Account | null, currencies: Currency[] }
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [this.data.account?.name || '', Validators.required],
      currencyId: [this.data.account?.currencyId || '', Validators.required],
      currentBalance: [this.data.account?.currentBalance || 0, Validators.required]
    });
  }

  onSave(): void {
    if (this.form.valid) {
      const account = new Account();
      if (this.data.account) {
        account.id = this.data.account.id;
        account.lastCheckpointBalance = this.data.account.lastCheckpointBalance;
        account.lastCheckpointDate = this.data.account.lastCheckpointDate;
      }
      account.name = this.form.value.name;
      account.currencyId = this.form.value.currencyId;
      account.currentBalance = this.form.value.currentBalance;
      this.dialogRef.close(account);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
