import { Component, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { AccountService } from '../../../logic/services/account.service';
import { RecurrentTransactionService } from '../../../logic/services/recurrent-transaction.service';
import { SavingsGoalService } from '../../../logic/services/savings-goal.service';
import { TransactionService } from '../../../logic/services/transaction.service';
import { Account, AccountType } from '../../../logic/types/account';
import { RecurrentTransaction } from '../../../logic/types/recurrent-transaction';
import { SavingsGoal } from '../../../logic/types/savings-goal';
import { Transaction } from '../../../logic/types/transaction';

interface SourceBalance {
  source: Account;
  balance: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  standalone: false
})
export class DashboardComponent implements OnInit {
  sourceBalances: SourceBalance[] = [];
  upcomingObligations: RecurrentTransaction[] = [];
  recentTransactions: Transaction[] = [];
  savingsGoals: SavingsGoal[] = [];
  AccountType = AccountType;

  private sourceMap = new Map<string, string>();

  constructor(
    private accountService: AccountService,
    private recurrentTransactionService: RecurrentTransactionService,
    private transactionService: TransactionService,
    private savingsGoalService: SavingsGoalService
  ) {}

  ngOnInit(): void {
    combineLatest([this.accountService.getAccounts()]).subscribe(([accounts]) => {
      this.sourceBalances = accounts.map((account) => ({
        source: account,
        balance: account.currentBalance
      }));
      this.sourceMap.clear();
      accounts.forEach((account) => this.sourceMap.set(account.id, account.name));
    });

    this.upcomingObligations = this.recurrentTransactionService.getDueManualTransactions().slice(0, 5);

    this.transactionService.getTransactions().subscribe(txs => {
      this.recentTransactions = [...txs]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
    });

    this.savingsGoalService.getGoals().subscribe(goals => {
      this.savingsGoals = goals;
    });
  }

  getSourceName(sourceId: string): string {
    return this.sourceMap.get(sourceId) ?? 'Unknown';
  }

  getTimeRemainingDisplay(rt: RecurrentTransaction): string {
    const info = this.recurrentTransactionService.getTimeRemaining(rt);
    if (info.isOverdue) {
      return info.days > 0 ? `Overdue ${info.days}d ${info.hours}h` : `Overdue ${info.hours}h ${info.minutes}m`;
    }
    return info.days > 0 ? `Due in ${info.days}d` : `Due in ${info.hours}h`;
  }

  isOverdue(rt: RecurrentTransaction): boolean {
    return this.recurrentTransactionService.getTimeRemaining(rt).isOverdue;
  }

  getGoalProgress(goal: SavingsGoal): number {
    return this.savingsGoalService.getProgressPercent(goal);
  }

  getGoalTotal(goal: SavingsGoal): number {
    return this.savingsGoalService.getTotalContributions(goal);
  }
}

