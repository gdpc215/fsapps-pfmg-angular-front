import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { CategoryService } from '../../../categories/services/category.service';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';
import { Transaction } from '../../../../core/models/transaction.model';

@Component({
  selector: 'app-transaction-explorer',
  standalone: false,
  templateUrl: './transaction-explorer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionExplorerComponent implements OnInit, OnDestroy {
  filterForm = new FormGroup({
    categoryId:    new FormControl<string|null>(null),
    subcategoryId: new FormControl<string|null>(null),
    accountId:     new FormControl<string|null>(null),
    textSearch:    new FormControl<string>(''),
    dateFrom:      new FormControl<string|null>(null),
    dateTo:        new FormControl<string|null>(null),
    amountMin:     new FormControl<number|null>(null),
    amountMax:     new FormControl<number|null>(null),
  });

  categories$ = this.categoryService.categories$;
  subcategories$ = this.categoryService.subcategories$;
  creditCards$ = this.creditCardService.cards$;
  debitAccounts$ = this.debitAccountService.accounts$;

  displayedColumns = ['date', 'account', 'description', 'amount', 'status'];

  private sub?: Subscription;

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.sub = this.filterForm.valueChanges.subscribe(() => {
      this.cdr.markForCheck();
    });

    // Reset subcategory when category changes
    this.filterForm.get('categoryId')!.valueChanges.subscribe(() => {
      this.filterForm.patchValue({ subcategoryId: null }, { emitEvent: false });
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  get filteredTransactions(): Transaction[] {
    const f = this.filterForm.value;
    let results = this.transactionService.getAll().filter(t => t.strStatus !== 'DELETED');

    if (f.subcategoryId) {
      results = results.filter(t => t.subcategoryId === f.subcategoryId);
    } else if (f.categoryId) {
      const subIds = this.categoryService.getSubcategoriesByCategoryId(f.categoryId).map(s => s.id);
      results = results.filter(t => t.subcategoryId && subIds.includes(t.subcategoryId));
    }

    if (f.accountId)   results = results.filter(t => t.accountId === f.accountId);
    if (f.textSearch)  results = results.filter(t =>
      t.strDescription.toLowerCase().includes(f.textSearch!.toLowerCase())
    );
    if (f.dateFrom)    results = results.filter(t => t.dateTransaction >= f.dateFrom!);
    if (f.dateTo)      results = results.filter(t => t.dateTransaction <= f.dateTo!);
    if (f.amountMin != null) results = results.filter(t => Math.abs(t.decAmountPen) >= f.amountMin!);
    if (f.amountMax != null) results = results.filter(t => Math.abs(t.decAmountPen) <= f.amountMax!);

    return results.sort((a, b) => b.dateTransaction.localeCompare(a.dateTransaction));
  }

  get aggregateTotal(): number {
    return this.filteredTransactions.reduce((s, t) => s + t.decAmountPen, 0);
  }

  get hasFilters(): boolean {
    const f = this.filterForm.value;
    return !!(f.categoryId || f.subcategoryId || f.accountId || f.textSearch || f.dateFrom || f.dateTo || f.amountMin != null || f.amountMax != null);
  }

  getSubcategoriesForSelected(): any[] {
    const catId = this.filterForm.value.categoryId;
    if (!catId) return [];
    return this.categoryService.getSubcategoriesByCategoryId(catId);
  }

  resolveAccountName(t: Transaction): string {
    if (t.accountType === 'CREDIT_CARD') {
      return this.creditCardService.getById(t.accountId)?.strName ?? '(unknown)';
    }
    return this.debitAccountService.getById(t.accountId)?.strName ?? '(unknown)';
  }
}
