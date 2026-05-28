import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TransactionService } from '../../services/transaction.service';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';
import { Transaction } from '../../../../core/models/transaction.model';

@Component({
  selector: 'app-transactions',
  standalone: false,
  templateUrl: './transactions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsComponent implements OnInit, OnDestroy {
  transactions: Transaction[] = [];
  displayedColumns = ['date', 'account', 'description', 'amount', 'status'];
  private sub?: Subscription;

  constructor(
    private transactionService: TransactionService,
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.reload();
    this.sub = this.transactionService.transactions$.subscribe(() => {
      this.reload();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private reload(): void {
    this.transactions = this.transactionService.getNonDeleted()
      .sort((a, b) => b.dateTransaction.localeCompare(a.dateTransaction));
    this.cdr.markForCheck();
  }

  resolveAccountName(t: Transaction): string {
    if (t.accountType === 'CREDIT_CARD') {
      return this.creditCardService.getById(t.accountId)?.strName ?? '(unknown)';
    }
    return this.debitAccountService.getById(t.accountId)?.strName ?? '(unknown)';
  }
}
