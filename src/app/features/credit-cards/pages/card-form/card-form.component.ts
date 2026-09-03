import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CreditCardService } from '../../services/credit-card.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-card-form',
  standalone: false,
  templateUrl: './card-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFormComponent implements OnInit {
  form = new FormGroup({
    strName:       new FormControl('', [Validators.required, Validators.maxLength(100)]),
    intClosingDay: new FormControl<number|null>(null, [Validators.required, Validators.min(1), Validators.max(31)]),
    intPaymentDay: new FormControl<number|null>(null, [Validators.required, Validators.min(1), Validators.max(31)]),
  });

  isEdit = false;
  private existingCard: any = null;

  constructor(
    private creditCardService: CreditCardService,
    private route: ActivatedRoute,
    private router: Router,
    private snackbar: SnackbarService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.existingCard = this.creditCardService.getById(id);
      if (this.existingCard) {
        this.form.patchValue(this.existingCard);
      }
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const data = { ...this.existingCard, ...this.form.value };
    this.creditCardService.save(data);
    this.snackbar.success(this.isEdit ? 'Card updated.' : 'Card added.');
    this.router.navigate(['/credit-cards']);
  }
}
