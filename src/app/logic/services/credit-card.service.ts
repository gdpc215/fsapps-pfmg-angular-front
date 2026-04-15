import { Injectable } from '@angular/core';
import { FinancialSourceType } from '../types/financial-source';
import { Transaction, TransactionType } from '../types/transaction';
import { SnapshotService } from './snapshot.service';
import { TransactionService } from './transaction.service';

@Injectable({ providedIn: 'root' })
export class CreditCardService {
  constructor(
    private snapshotService: SnapshotService,
    private transactionService: TransactionService
  ) {}

  estimateCycleInterest(source: { id: string; type: FinancialSourceType }, cycleClosingDate: string): Transaction {
    if (source.type !== FinancialSourceType.CREDIT_CARD) {
      throw new Error('Interest estimation only applies to credit cards.');
    }

    const before = this.snapshotService.getLastBefore(source.id, cycleClosingDate);
    const after = this.snapshotService.getFirstAfter(source.id, cycleClosingDate);

    if (!before || !after) {
      throw new Error('Missing required snapshots around the cycle closing date.');
    }

    const from = before.datetime.slice(0, 10);
    const to = after.datetime.slice(0, 10);
    const cycleTransactions = this.transactionService.getInRange(source.id, from, to);
    const cycleSum = cycleTransactions.reduce((sum, tx) => sum + (tx.amountPen ?? tx.amount), 0);
    const interestAmount = after.balance - before.balance - cycleSum;

    const interest = new Transaction();
    interest.sourceId = source.id;
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
