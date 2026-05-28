import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { RecurrentTransactionService } from '../../services/recurrent-transaction.service';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AccountType } from '../../../../core/models/transaction.model';

@Component({
  selector: 'app-recurrent-form',
  standalone: false,
  templateUrl: './recurrent-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrentFormComponent implements OnInit {
  form = new FormGroup({
    strName:         new FormControl('', [Validators.required]),
    strNotes:        new FormControl(''),
    accountId:       new FormControl<string|null>(null, Validators.required),
    strFrequency:    new FormControl<'MONTHLY'|'YEARLY'>('MONTHLY', Validators.required),
    strMatchMode:    new FormControl<'MANUAL'|'AUTOMATIC'>('MANUAL', Validators.required),
    strCurrency:     new FormControl<string|null>(null),
    decApproxAmount: new FormControl<number|null>(null),
    decAmountRange:  new FormControl<number|null>(0),
    strMatchString:  new FormControl<string|null>(null),
    intApproxDay:    new FormControl<number|null>(null),
    intApproxMonth:  new FormControl<number|null>(null),
    intDayRange:     new FormControl<number|null>(null),
  });

  isEdit = false;
  private existingRecord: any = null;
  private selectedAccountType: AccountType = 'CREDIT_CARD';

  creditCards$ = this.creditCardService.cards$;
  debitAccounts$ = this.debitAccountService.accounts$;

  constructor(
    private recurrentService: RecurrentTransactionService,
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
    private route: ActivatedRoute,
    private router: Router,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.existingRecord = this.recurrentService.getAll().find(r => r.id === id);
      if (this.existingRecord) {
        this.selectedAccountType = this.existingRecord.accountType;
        this.form.patchValue(this.existingRecord);
      }
    }
    this.form.get('strMatchMode')!.valueChanges.subscribe(() => this.updateAutomaticValidators());
  }

  get isAutomatic(): boolean { return this.form.value.strMatchMode === 'AUTOMATIC'; }
  get isYearly(): boolean { return this.form.value.strFrequency === 'YEARLY'; }

  onAccountSelect(accountId: string): void {
    const card = this.creditCardService.getById(accountId);
    this.selectedAccountType = card ? 'CREDIT_CARD' : 'DEBIT_ACCOUNT';
  }

  private updateAutomaticValidators(): void {
    const autoControls = ['decApproxAmount', 'strMatchString', 'intDayRange'];
    if (this.isAutomatic) {
      autoControls.forEach(name => {
        const ctrl = this.form.get(name)!;
        ctrl.setValidators([Validators.required]);
        ctrl.updateValueAndValidity();
      });
    } else {
      autoControls.forEach(name => {
        const ctrl = this.form.get(name)!;
        ctrl.clearValidators();
        ctrl.updateValueAndValidity();
      });
    }
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.value;
    const isAuto = v.strMatchMode === 'AUTOMATIC';
    const data: any = {
      ...this.existingRecord,
      strName: v.strName,
      strNotes: v.strNotes || undefined,
      accountId: v.accountId,
      accountType: this.selectedAccountType,
      strFrequency: v.strFrequency,
      strMatchMode: v.strMatchMode,
      ...(isAuto ? {
        strCurrency: v.strCurrency || undefined,
        decApproxAmount: v.decApproxAmount,
        decAmountRange: v.decAmountRange ?? 0,
        strMatchString: v.strMatchString,
        intApproxDay: v.intApproxDay || undefined,
        intApproxMonth: v.strFrequency === 'YEARLY' ? v.intApproxMonth || undefined : undefined,
        intDayRange: v.intDayRange,
      } : {
        strCurrency: undefined, decApproxAmount: undefined,
        decAmountRange: undefined, strMatchString: undefined,
        intApproxDay: v.intApproxDay || undefined, intDayRange: undefined,
      }),
    };
    this.recurrentService.save(data);
    this.snackbar.success(this.isEdit ? 'Updated.' : 'Added.');
    this.router.navigate(['/recurrent-transactions']);
  }
}
