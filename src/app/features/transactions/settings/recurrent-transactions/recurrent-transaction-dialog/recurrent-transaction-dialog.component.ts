import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Account, AccountType } from '../../../../../logic/types/account';
import { Category } from '../../../../../logic/types/category';
import { Currency } from '../../../../../logic/types/currency';
import { ExecutionMode, RecurrenceType, RecurrentTransaction } from '../../../../../logic/types/recurrent-transaction';
import { TransactionType } from '../../../../../logic/types/transaction';

@Component({
  selector: 'app-recurrent-transaction-dialog',
  templateUrl: './recurrent-transaction-dialog.component.html',
  standalone: false
})
export class RecurrentTransactionDialogComponent implements OnInit {
  form!: FormGroup;
  isTransfer = false;
  availableTargetAccounts: Account[] = [];
  availableCurrencies: string[] = [];
  topLevelCategories: Category[] = [];
  subcategories: Category[] = [];
  
  TransactionType = TransactionType;
  RecurrenceType = RecurrenceType;
  ExecutionMode = ExecutionMode;
  
  monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                'July', 'August', 'September', 'October', 'November', 'December'];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<RecurrentTransactionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      recurrentTransaction: RecurrentTransaction | null, 
      accounts: Account[], 
      currencies: Currency[],
      categories: Category[]
    }
  ) {}

  ngOnInit(): void {
    const rt = this.data.recurrentTransaction;
    this.isTransfer = rt?.type === TransactionType.TRANSFER;

    // Filter top-level categories
    this.topLevelCategories = this.data.categories.filter(c => c.parentId === null);
    
    // If editing and has category, load subcategories
    if (rt?.categoryId) {
      this.loadSubcategories(rt.categoryId);
    }

    this.form = this.fb.group({
      name: [rt?.name || '', Validators.required],
      active: [rt?.active !== undefined ? rt.active : true],
      executionMode: [rt?.executionMode || ExecutionMode.MANUAL, Validators.required],
      maxDaysToExecute: [rt?.maxDaysToExecute || 30],
      type: [rt?.type || TransactionType.EXPENSE, Validators.required],
      accountOrCardId: [rt?.accountOrCardId || '', Validators.required],
      targetAccountOrCardId: [rt?.targetAccountOrCardId || null],
      payee: [rt?.payee || ''],
      description: [rt?.description || '', Validators.required],
      notes: [rt?.notes || ''],
      labels: [rt?.labels || []],
      categoryId: [rt?.categoryId || null],
      subcategoryId: [rt?.subcategoryId || null],
      currency: [rt?.currency || '', Validators.required],
      amount: [rt?.amount || 0, Validators.required],
      recurrenceType: [rt?.recurrenceType || RecurrenceType.DAY_OF_MONTH, Validators.required],
      dayOfMonth: [rt?.dayOfMonth || 1],
      month: [rt?.month || 1],
      dayOfYear: [rt?.dayOfYear || 1]
    });

    if (rt?.accountOrCardId) {
      this.updateAvailableTargetAccounts(rt.accountOrCardId);
      this.onAccountChange();
    }

    this.onTypeChange();
  }

  loadSubcategories(categoryId: string | null): void {
    if (categoryId) {
      this.subcategories = this.data.categories.filter(c => c.parentId === categoryId);
    } else {
      this.subcategories = [];
      this.form.patchValue({ subcategoryId: null });
    }
  }

  onCategoryChange(): void {
    const categoryId = this.form.get('categoryId')?.value;
    this.loadSubcategories(categoryId);
  }

  onTypeChange(): void {
    const type = this.form.get('type')?.value;
    this.isTransfer = type === TransactionType.TRANSFER;

    const targetControl = this.form.get('targetAccountOrCardId');
    if (this.isTransfer) {
      targetControl?.setValidators([Validators.required]);
    } else {
      targetControl?.clearValidators();
      targetControl?.setValue(null);
    }
    targetControl?.updateValueAndValidity();
  }

  onAccountChange(): void {
    const accountId = this.form.get('accountOrCardId')?.value;
    if (accountId) {
      this.updateAvailableTargetAccounts(accountId);
      
      const account = this.data.accounts.find(a => a.id === accountId);
      if (account) {
        const accountCurrency = this.data.currencies.find(c => c.id === account.currencyId);
        
        if (account.type === AccountType.DEBIT) {
          if (accountCurrency) {
            this.form.patchValue({ currency: accountCurrency.code });
            this.availableCurrencies = [accountCurrency.code];
          }
          this.form.get('currency')?.disable();
        } else {
          this.availableCurrencies = this.data.currencies.map(c => c.code);
          this.form.get('currency')?.enable();
          if (!this.form.get('currency')?.value && accountCurrency) {
            this.form.patchValue({ currency: accountCurrency.code });
          }
        }
      }
    }
  }

  updateAvailableTargetAccounts(sourceAccountId: string): void {
    this.availableTargetAccounts = this.data.accounts.filter(a => a.id !== sourceAccountId);
    
    const currentTarget = this.form.get('targetAccountOrCardId')?.value;
    if (currentTarget === sourceAccountId) {
      this.form.patchValue({ targetAccountOrCardId: null });
    }
  }

  addLabel(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value) {
      const labels = this.form.get('labels')?.value || [];
      this.form.patchValue({ labels: [...labels, value] });
    }
    event.chipInput?.clear();
  }

  removeLabel(label: string): void {
    const labels = this.form.get('labels')?.value || [];
    const index = labels.indexOf(label);
    if (index >= 0) {
      labels.splice(index, 1);
      this.form.patchValue({ labels: [...labels] });
    }
  }

  onSave(): void {
    if (this.form.valid) {
      const formValue = this.form.getRawValue(); // getRawValue to include disabled fields
      
      if (!formValue.accountOrCardId) {
        alert('Please select an account.');
        return;
      }

      const isTransfer = formValue.type === TransactionType.TRANSFER;
      if (isTransfer && !formValue.targetAccountOrCardId) {
        alert('Please select a target account for the transfer.');
        return;
      }

      const result: RecurrentTransaction = {
        id: this.data.recurrentTransaction?.id || '',
        name: formValue.name,
        active: formValue.active,
        executionMode: formValue.executionMode,
        maxDaysToExecute: formValue.maxDaysToExecute,
        type: formValue.type,
        accountOrCardId: formValue.accountOrCardId,
        payee: formValue.payee,
        description: formValue.description,
        notes: formValue.notes,
        currency: formValue.currency,
        amount: formValue.amount,
        categoryId: formValue.categoryId,
        subcategoryId: formValue.subcategoryId,
        labels: formValue.labels,
        targetAccountOrCardId: formValue.targetAccountOrCardId,
        recurrenceType: formValue.recurrenceType,
        dayOfMonth: formValue.recurrenceType === RecurrenceType.DAY_OF_MONTH ? formValue.dayOfMonth : undefined,
        month: formValue.recurrenceType === RecurrenceType.DAY_OF_YEAR ? formValue.month : undefined,
        dayOfYear: formValue.recurrenceType === RecurrenceType.DAY_OF_YEAR ? formValue.dayOfYear : undefined,
        lastExecuted: this.data.recurrentTransaction?.lastExecuted || null,
        nextExecution: this.data.recurrentTransaction?.nextExecution || null,
        skippedUntil: this.data.recurrentTransaction?.skippedUntil || null
      };

      this.dialogRef.close(result);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
