import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DebitAccountService } from '../../services/debit-account.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-debit-account-form',
  standalone: false,
  templateUrl: './debit-account-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebitAccountFormComponent implements OnInit {
  form = new FormGroup({
    strName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
  });

  isEdit = false;
  private existingAccount: any = null;

  constructor(
    private debitAccountService: DebitAccountService,
    private route: ActivatedRoute,
    private router: Router,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.existingAccount = this.debitAccountService.getById(id);
      if (this.existingAccount) {
        this.form.patchValue(this.existingAccount);
      }
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const data = { ...this.existingAccount, ...this.form.value };
    this.debitAccountService.save(data);
    this.snackbar.success(this.isEdit ? 'Account updated.' : 'Account added.');
    this.router.navigate(['/debit-accounts']);
  }
}
