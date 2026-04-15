import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CurrencyService } from '../../../../../logic/services/currency.service';
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
  currencies: Currency[] = [];
  creditPanelOpen = false;

  get isEditing(): boolean {
    return !!this.data.account;
  }

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AccountDialogComponent>,
    private currencyService: CurrencyService,
    @Inject(MAT_DIALOG_DATA) public data: { account: Account | null, currencies?: Currency[] }
  ) {}

  ngOnInit(): void {
    this.currencyService.getCurrencies().subscribe(c => (this.currencies = c));

    const existing = this.data.account;
    const defaultPaymentCurrency = existing?.paymentCurrencyId || existing?.currencyId || '';

    this.form = this.fb.group({
      name: [existing?.name || '', Validators.required],
      color: [existing?.color || '#ba68c8', Validators.required],
      type: [existing?.type || AccountType.DEBIT, Validators.required],
      currencyId: [existing?.currencyId || '', Validators.required],
      initialBalance: [existing?.initialBalance ?? 0, Validators.required],
      paymentCurrencyId: [defaultPaymentCurrency],
      paymentDate: [existing?.paymentDate || null],
      billingDate: [existing?.billingDate || null],
      creditLimit: [existing?.creditLimit || null]
    });

    // Open credit card panel by default when editing a credit card
    this.creditPanelOpen = existing?.type === AccountType.CREDIT;

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
