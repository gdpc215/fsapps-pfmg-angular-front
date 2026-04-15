import { Component, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { BalanceService } from '../../../logic/services/balance.service';
import { FinancialSourceService } from '../../../logic/services/financial-source.service';
import { RecurrentTransactionService } from '../../../logic/services/recurrent-transaction.service';
import { SavingsGoalService } from '../../../logic/services/savings-goal.service';
import { TransactionService } from '../../../logic/services/transaction.service';
import { FinancialSource, FinancialSourceType } from '../../../logic/types/financial-source';
import { RecurrentTransaction } from '../../../logic/types/recurrent-transaction';
import { SavingsGoal } from '../../../logic/types/savings-goal';
import { Transaction } from '../../../logic/types/transaction';

interface SourceBalance {
  source: FinancialSource;
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

  private sourceMap = new Map<string, string>();
  FinancialSourceType = FinancialSourceType;

  constructor(
    private financialSourceService: FinancialSourceService,
    private balanceService: BalanceService,
    private recurrentTransactionService: RecurrentTransactionService,
    private transactionService: TransactionService,
    private savingsGoalService: SavingsGoalService
  ) {}

  ngOnInit(): void {
    combineLatest([
      this.financialSourceService.getSources(),
      this.balanceService.changes$
    ]).subscribe(([sources]) => {
      this.sourceBalances = sources.map(source => ({
        source,
        balance: this.balanceService.getCurrentBalance(source.id)
      }));
      this.sourceMap.clear();
      sources.forEach(s => this.sourceMap.set(s.id, s.name));
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

