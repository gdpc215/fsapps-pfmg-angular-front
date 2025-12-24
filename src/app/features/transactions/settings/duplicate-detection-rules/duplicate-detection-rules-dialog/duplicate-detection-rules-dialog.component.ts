import { Component, Inject, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Constants } from '../../../../../logic/constants';
import { CurrencyService } from '../../../../../logic/services/currency.service';
import { DuplicateDetectionRule } from '../../../../../logic/services/movement.service';
import { Currency } from '../../../../../logic/types/currency';

@Component({
  selector: 'app-duplicate-detection-rules-dialog',
  templateUrl: './duplicate-detection-rules-dialog.component.html',
  standalone: false
})
export class DuplicateDetectionRulesDialogComponent implements OnInit {
  rules: DuplicateDetectionRule[] = [];
  form!: FormGroup;
  accountTypes = [
    { label: 'Debit', value: 'debit' },
    { label: 'Credit', value: 'credit' }
  ];
  currencies: Currency[] = [];

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<DuplicateDetectionRulesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { rules: DuplicateDetectionRule[] },
    private currencyService: CurrencyService
  ) {
    this.rules = data.rules ? [...data.rules] : [];
  }

  ngOnInit(): void {
    // Initialize form
    this.form = this.fb.group({
      equivalencies: this.fb.array([
        this.fb.control('', Validators.required),
        this.fb.control('', Validators.required)
      ]),
      accountTypes: this.fb.group({
        debit: false,
        credit: false
      }),
      currencies: this.fb.array([])
    });

    this.currencyService.getCurrencies().subscribe(currencies => {
      this.currencies = currencies;
      const currencyControls = currencies.map(() => this.fb.control(false));
      this.form.setControl('currencies', this.fb.array(currencyControls));
    });
  }

  get equivalencies(): FormArray {
    return this.form.get('equivalencies') as FormArray;
  }

  get currencyControls(): FormArray {
    return this.form.get('currencies') as FormArray;
  }

  addEquivalencyBox() {
    this.equivalencies.push(this.fb.control('', Validators.required));
  }

  removeEquivalencyBox(idx: number) {
    if (this.equivalencies.length > 2) {
      this.equivalencies.removeAt(idx);
    }
  }

  // Save: read values from form, create rules, persist and return updated list
  saveDialog() {
    const group = this.equivalencies.controls.map(c => c.value.trim()).filter(Boolean);
    const accountGroup = this.form.get('accountTypes') as FormGroup;
    const selectedAccountTypes: string[] = [];
    if (accountGroup.get('debit')?.value) selectedAccountTypes.push('debit');
    if (accountGroup.get('credit')?.value) selectedAccountTypes.push('credit');

    const selectedCurrencies = this.currencyControls.controls
      .map((c, i) => c.value ? this.currencies[i].code : null)
      .filter(Boolean) as string[];

    let newRules = [...this.rules];
    if (group.length > 1 && selectedAccountTypes.length > 0 && selectedCurrencies.length > 0) {
      for (const accType of selectedAccountTypes) {
        newRules.push({
          descriptionGroup: group,
          accountType: accType as 'debit' | 'credit',
          currencies: selectedCurrencies
        });
      }
    }

    localStorage.setItem(Constants.StorageTags.DUPLICATE_DETECTION_RULES, JSON.stringify(newRules));
    this.dialogRef.close([...newRules]);
  }

  removeRule(idx: number) {
    this.rules.splice(idx, 1);
  }

  cancel() {
    this.dialogRef.close();
  }
}
