import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatChipInputEvent } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Account, AccountType } from '../../../../logic/types/account';
import { Category } from '../../../../logic/types/category';
import { Currency } from '../../../../logic/types/currency';
import { Movement, MovementType } from '../../../../logic/types/movement';

@Component({
  selector: 'app-movement-form-dialog',
  templateUrl: './movement-form-dialog.component.html',
  standalone: false
})
export class MovementFormDialogComponent implements OnInit {
  form!: FormGroup;
  isTransfer = false;
  availableTargetAccounts: Account[] = [];
  availableCurrencies: string[] = []; // Available currency codes for the selected account
  topLevelCategories: Category[] = [];
  subcategories: Category[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<MovementFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      movement: Movement | null, 
      accounts: Account[], 
      currencies: Currency[],
      categories: Category[]
    }
  ) {}

  ngOnInit(): void {
    const movement = this.data.movement;
    this.isTransfer = movement?.type === MovementType.TRANSFER;

    // Filter top-level categories
    this.topLevelCategories = this.data.categories.filter(c => c.parentId === null);
    
    // If editing and has category, load subcategories
    if (movement?.categoryId) {
      this.loadSubcategories(movement.categoryId);
    }

    this.form = this.fb.group({
      type: [movement?.type || MovementType.EXPENSE, Validators.required],
      date: [movement?.date || new Date(), Validators.required],
      accountOrCardId: [movement?.accountOrCardId || '', Validators.required],
      targetAccountOrCardId: [movement?.targetAccountOrCardId || null],
      description: [movement?.description || '', Validators.required],
      payee: [movement?.payee || ''],
      notes: [movement?.notes || ''],
      labels: [movement?.labels || []],
      categoryId: [movement?.categoryId || null],
      subcategoryId: [movement?.subcategoryId || null],
      currency: [movement?.currency || '', Validators.required],
      amount: [movement?.amount || 0, Validators.required],
      operationNumber: [movement?.operationNumber || null]
    });

    if (movement?.accountOrCardId) {
      this.updateAvailableTargetAccounts(movement.accountOrCardId);
      // Trigger currency setup for existing account
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

  get amountHint(): string {
    const type = this.form.get('type')?.value;
    switch (type) {
      case MovementType.EXPENSE:
        return 'Enter as positive number (will be stored as negative)';
      case MovementType.INCOME:
        return 'Enter as positive number';
      case MovementType.TRANSFER:
        return 'Amount to transfer';
      default:
        return '';
    }
  }

  onTypeChange(): void {
    const type = this.form.get('type')?.value;
    this.isTransfer = type === MovementType.TRANSFER;

    // Update validators based on type
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
        // Get the currency code for this account
        const accountCurrency = this.data.currencies.find(c => c.id === account.currencyId);
        
        if (account.type === AccountType.DEBIT) {
          // For debit accounts, force the account's currency
          if (accountCurrency) {
            this.form.patchValue({ currency: accountCurrency.code });
            this.availableCurrencies = [accountCurrency.code];
          }
          // Make currency field read-only for debit accounts
          this.form.get('currency')?.disable();
        } else {
          // For credit accounts, allow any currency
          this.availableCurrencies = this.data.currencies.map(c => c.code);
          this.form.get('currency')?.enable();
          // Pre-fill with account currency if empty
          if (!this.form.get('currency')?.value && accountCurrency) {
            this.form.patchValue({ currency: accountCurrency.code });
          }
        }
      }
    }
  }

  updateAvailableTargetAccounts(sourceAccountId: string): void {
    this.availableTargetAccounts = this.data.accounts.filter(a => a.id !== sourceAccountId);
    
    // If current target is same as source, clear it
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
    event.chipInput!.clear();
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
    // Validate account is selected
    if (!this.form.value.accountOrCardId) {
      alert('Please select an account');
      return;
    }

    // Validate transfer has target account
    if (this.isTransfer && !this.form.value.targetAccountOrCardId) {
      alert('Please select a target account for the transfer');
      return;
    }

    if (this.form.valid || (this.form.get('currency')?.disabled && this.form.get('currency')?.value)) {
      const movement = new Movement();
      
      if (this.data.movement) {
        movement.id = this.data.movement.id;
      }

      movement.type = this.form.value.type;
      movement.accountOrCardId = this.form.value.accountOrCardId;
      movement.date = this.form.value.date;
      movement.description = this.form.value.description;
      movement.payee = this.form.value.payee;
      movement.notes = this.form.value.notes;
      movement.labels = this.form.value.labels;
      movement.categoryId = this.form.value.categoryId;
      movement.subcategoryId = this.form.value.subcategoryId;
      // Get currency value even if field is disabled (for debit accounts)
      movement.currency = this.form.get('currency')?.value || this.form.value.currency;
      
      // Handle amount based on type
      let amount = Math.abs(this.form.value.amount);
      if (movement.type === MovementType.EXPENSE) {
        amount = -amount; // Store expenses as negative
      }
      movement.amount = amount;
      
      movement.operationNumber = this.form.value.operationNumber;
      movement.targetAccountOrCardId = this.form.value.targetAccountOrCardId;

      this.dialogRef.close(movement);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
