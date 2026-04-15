import { Injectable } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { SnapshotService } from './snapshot.service';
import { TransactionService } from './transaction.service';

@Injectable({ providedIn: 'root' })
export class BalanceService {
  /** Emits whenever snapshots or transactions change — use to trigger balance recomputation. */
  readonly changes$: Observable<void>;

  constructor(
    private transactionService: TransactionService,
    private snapshotService: SnapshotService
  ) {
    this.changes$ = combineLatest([
      snapshotService.getSnapshots(),
      transactionService.getTransactions()
    ]).pipe(map(() => undefined));
  }

  getCurrentBalance(sourceId: string): number {
    const snapshots = this.snapshotService.getBySource(sourceId);
    const latestSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;

    if (!latestSnapshot) {
      return this.transactionService
        .getBySource(sourceId)
        .reduce((sum, tx) => sum + this.getAmountForBalance(tx), 0);
    }

    // Snapshot captures the closing balance for its date; only count transactions from the next day onward.
    const anchor = this.nextDayStart(latestSnapshot.datetime);
    const delta = this.transactionService
      .getBySource(sourceId)
      .filter((tx) => new Date(tx.date).getTime() >= anchor)
      .reduce((sum, tx) => sum + this.getAmountForBalance(tx), 0);

    return latestSnapshot.balance + delta;
  }

  getBalanceAtDate(sourceId: string, targetDate: string): number {
    const target = new Date(targetDate).getTime();
    const beforeOrEqual = this.snapshotService
      .getBySource(sourceId)
      .filter((s) => new Date(s.datetime).getTime() <= target);

    const latestSnapshot = beforeOrEqual.length ? beforeOrEqual[beforeOrEqual.length - 1] : null;

    if (!latestSnapshot) {
      return this.transactionService
        .getBySource(sourceId)
        .filter((tx) => new Date(tx.date).getTime() <= target)
        .reduce((sum, tx) => sum + this.getAmountForBalance(tx), 0);
    }

    const anchor = this.nextDayStart(latestSnapshot.datetime);
    const delta = this.transactionService
      .getBySource(sourceId)
      .filter((tx) => {
        const txTime = new Date(tx.date).getTime();
        return txTime >= anchor && txTime <= target;
      })
      .reduce((sum, tx) => sum + this.getAmountForBalance(tx), 0);

    return latestSnapshot.balance + delta;
  }

  /** Returns the timestamp (ms) for midnight at the start of the day *after* the given datetime string. */
  private nextDayStart(datetime: string): number {
    const date = new Date(datetime.slice(0, 10)); // strip time, treat as local date
    date.setDate(date.getDate() + 1);
    return date.getTime();
  }

  private getAmountForBalance(tx: { amount: number; amountPen?: number }): number {
    if (typeof tx.amountPen === 'number') {
      return tx.amountPen;
    }
    return tx.amount;
  }
}
