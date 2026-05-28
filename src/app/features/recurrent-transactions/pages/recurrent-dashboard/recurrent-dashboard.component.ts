import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { RecurrentTransactionService } from '../../services/recurrent-transaction.service';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { DebitAccountService } from '../../../debit-accounts/services/debit-account.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { RecurrentMatchingService } from '../../../../core/services/recurrent-matching.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { RecurrentTransaction } from '../../../../core/models/recurrent-transaction.model';
import { RecurrentTransactionMatch } from '../../../../core/models/recurrent-transaction-match.model';
import { AccountType } from '../../../../core/models/transaction.model';

type RecurrentStatus = 'DONE' | 'PENDING' | 'NOT_YET_DUE' | 'NOT_CONFIGURED';

interface DashboardRow {
  recurrent: RecurrentTransaction;
  accountName: string;
  iterations: {
    key: string;
    targetDate: string | undefined;
    status: RecurrentStatus;
    match: RecurrentTransactionMatch | undefined;
    isCurrent: boolean;
  }[];
}

@Component({
  selector: 'app-recurrent-dashboard',
  standalone: false,
  templateUrl: './recurrent-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecurrentDashboardComponent implements OnInit, OnDestroy {
  todayDate = new Date().toISOString().slice(0, 10);
  dashboardRows: DashboardRow[] = [];
  private sub?: Subscription;

  constructor(
    private recurrentService: RecurrentTransactionService,
    private creditCardService: CreditCardService,
    private debitAccountService: DebitAccountService,
    private transactionService: TransactionService,
    private recurrentMatchingService: RecurrentMatchingService,
    private dialog: MatDialog,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.recompute();
    this.sub = this.transactionService.transactions$.subscribe(() => {
      this.recompute();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private recompute(): void {
    const recurrents = this.recurrentService.getAll();
    const allMatches = this.recurrentService.getAllMatches();

    this.dashboardRows = recurrents.map(r => {
      const currentKey = this.recurrentMatchingService.getCurrentIterationKey(r.strFrequency, this.todayDate);
      const previousKey = this.recurrentMatchingService.getPreviousIterationKey(r.strFrequency, currentKey);
      const keys = [currentKey, previousKey];

      return {
        recurrent: r,
        accountName: this.resolveAccountName(r.accountId, r.accountType),
        iterations: keys.map((key, idx) => ({
          key,
          targetDate: this.recurrentMatchingService.buildTargetDate(r, key),
          status: this.computeStatus(r, key, allMatches),
          match: allMatches.find(m => m.recurrentTransactionId === r.id && m.strIterationKey === key),
          isCurrent: idx === 0,
        })),
      };
    });

    // Sort: PENDING first, then NOT_YET_DUE, NOT_CONFIGURED, DONE
    const order: RecurrentStatus[] = ['PENDING', 'NOT_YET_DUE', 'NOT_CONFIGURED', 'DONE'];
    this.dashboardRows.sort((a, b) => {
      const aStatus = a.iterations[0].status;
      const bStatus = b.iterations[0].status;
      const diff = order.indexOf(aStatus) - order.indexOf(bStatus);
      return diff !== 0 ? diff : a.recurrent.strName.localeCompare(b.recurrent.strName);
    });

    this.cdr.markForCheck();
  }

  private computeStatus(r: RecurrentTransaction, iterationKey: string, allMatches: RecurrentTransactionMatch[]): RecurrentStatus {
    const match = allMatches.find(m => m.recurrentTransactionId === r.id && m.strIterationKey === iterationKey);
    if (match?.boolDone) return 'DONE';
    const targetDate = this.recurrentMatchingService.buildTargetDate(r, iterationKey);
    if (!targetDate) return 'NOT_CONFIGURED';
    const dayRange = r.intDayRange ?? 0;
    const windowOpen = new Date(new Date(targetDate).getTime() - dayRange * 86_400_000);
    return new Date(this.todayDate) < windowOpen ? 'NOT_YET_DUE' : 'PENDING';
  }

  private resolveAccountName(accountId: string, accountType: AccountType): string {
    if (accountType === 'CREDIT_CARD') return this.creditCardService.getById(accountId)?.strName ?? '(unknown)';
    return this.debitAccountService.getById(accountId)?.strName ?? '(unknown)';
  }

  get hasPendingCurrent(): boolean {
    return this.dashboardRows.some(row => row.iterations[0].status === 'PENDING');
  }

  markDone(r: RecurrentTransaction, key: string): void {
    this.recurrentService.saveMatch({
      recurrentTransactionId: r.id,
      strIterationKey: key,
      transactionId: undefined,
      boolDone: true,
      dateDone: this.todayDate,
      strMatchMode: 'MANUAL',
    });
    this.snackbar.success('Marked as done.');
  }

  unlink(match: RecurrentTransactionMatch): void {
    this.recurrentService.deleteMatch(match.id);
    this.snackbar.success('Unlinked.');
  }

  markAllPendingDone(): void {
    this.dashboardRows.forEach(row => {
      if (row.iterations[0].status === 'PENDING') {
        this.markDone(row.recurrent, row.iterations[0].key);
      }
    });
  }
}
