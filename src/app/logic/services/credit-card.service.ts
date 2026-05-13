import { Injectable } from '@angular/core';
import { Transaction, TransactionType } from '../types/transaction';
import { CardBalanceSnapshotService } from './card-balance-snapshot.service';
import { TransactionService } from './transaction.service';

@Injectable({ providedIn: 'root' })
export class CreditCardService {
  constructor(
    private cardBalanceSnapshotService: CardBalanceSnapshotService,
    private transactionService: TransactionService
  ) {}

  estimateCycleInterest(accountId: string, cycleClosingDate: string): Transaction {
    const before = this.cardBalanceSnapshotService.getLatestSnapshotBeforeOrOn(accountId, cycleClosingDate);
    const after = this.cardBalanceSnapshotService
      .getSnapshotsByAccountId(accountId)
      .filter(s => new Date(s.snapshotDate) > new Date(cycleClosingDate))
      .sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime())[0];

    if (!before || !after) {
      throw new Error('Missing required snapshots around the cycle closing date.');
    }

    const from = before.snapshotDate;
    const to = after.snapshotDate;
    const cycleTransactions = this.transactionService.getInRange(accountId, from, to);
    const cycleSum = cycleTransactions.reduce((sum, tx) => sum + (tx.amountPen ?? tx.amount), 0);
    const beforeWithDelta = before.owedAmount + (before.delta ?? 0);
    const afterWithDelta = after.owedAmount + (after.delta ?? 0);
    const interestAmount = afterWithDelta - beforeWithDelta - cycleSum;

    const interest = new Transaction();
    interest.sourceId = accountId;
    interest.date = cycleClosingDate;
    interest.description = 'Estimated cycle interest';
    interest.normalizedDescription = 'estimatedcycleinterest';
    interest.currency = 'PEN';
    interest.amount = interestAmount;
    interest.amountPen = interestAmount;
    interest.type = TransactionType.INTEREST;

    return interest;
  }
}
