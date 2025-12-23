import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Account, AccountType } from '../../../../../logic/types/account';
import { Currency } from '../../../../../logic/types/currency';

@Component({
  selector: 'app-account-dialog',
  templateUrl: './account-dialog.component.html',
  standalone: false
})
export class AccountDialogComponent implements OnInit {
  form!: FormGroup;
  accountTypes = Object.values(AccountType);
  AccountType = AccountType;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AccountDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { account: Account | null, currencies: Currency[] }
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: [this.data.account?.name || '', Validators.required],
      color: [this.data.account?.color || '#ba68c8', Validators.required],
      type: [this.data.account?.type || AccountType.DEBIT, Validators.required],
      currencyId: [this.data.account?.currencyId || '', Validators.required],
      initialBalance: [this.data.account?.initialBalance || 0, Validators.required],
      paymentCurrencyId: [this.data.account?.paymentCurrencyId || ''],
      paymentDate: [this.data.account?.paymentDate || null],
      billingDate: [this.data.account?.billingDate || null],
      creditLimit: [this.data.account?.creditLimit || null]
    });

    // Watch for account type changes to update validators
    this.form.get('type')?.valueChanges.subscribe(type => {
      this.updateValidators(type);
    });

    // Initialize validators
    this.updateValidators(this.form.get('type')?.value);
  }

  updateValidators(type: AccountType): void {
    const paymentCurrencyControl = this.form.get('paymentCurrencyId');
    const paymentDateControl = this.form.get('paymentDate');
    const billingDateControl = this.form.get('billingDate');
    
    if (type === AccountType.CREDIT) {
      paymentCurrencyControl?.setValidators([Validators.required]);
      paymentDateControl?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
      billingDateControl?.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
    } else {
      paymentCurrencyControl?.clearValidators();
      paymentDateControl?.clearValidators();
      billingDateControl?.clearValidators();
    }
    
    paymentCurrencyControl?.updateValueAndValidity();
    paymentDateControl?.updateValueAndValidity();
    billingDateControl?.updateValueAndValidity();
  }

  get isCredit(): boolean {
    return this.form.get('type')?.value === AccountType.CREDIT;
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
      account.color = this.form.value.color;
      account.type = this.form.value.type;
      account.currencyId = this.form.value.currencyId;
      account.initialBalance = this.form.value.initialBalance;
      account.currentBalance = this.data.account?.currentBalance || this.form.value.initialBalance;
      
      if (account.type === AccountType.CREDIT) {
        account.paymentCurrencyId = this.form.value.paymentCurrencyId;
        account.paymentDate = this.form.value.paymentDate;
        account.billingDate = this.form.value.billingDate;
        account.creditLimit = this.form.value.creditLimit;
      }
      
      this.dialogRef.close(account);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
