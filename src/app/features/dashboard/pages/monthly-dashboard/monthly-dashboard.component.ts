import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { CategoryService } from '../../../categories/services/category.service';
import { DashboardCalculatorService, MonthlyDashboardData } from '../../../../core/services/dashboard-calculator.service';

@Component({
  selector: 'app-monthly-dashboard',
  standalone: false,
  templateUrl: './monthly-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthlyDashboardComponent implements OnInit, OnDestroy {
  selectedMonth: string;
  currentMonth: string;
  hideTransfers = false;
  data: MonthlyDashboardData | null = null;
  private sub?: Subscription;

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private dashboardCalc: DashboardCalculatorService,
    private cdr: ChangeDetectorRef,
  ) {
    const now = new Date();
    this.currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.selectedMonth = this.currentMonth;
  }

  ngOnInit(): void {
    this.recompute();
    this.sub = this.transactionService.transactions$.subscribe(() => this.recompute());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  changeMonth(delta: number): void {
    const [y, m] = this.selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    this.selectedMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    this.recompute();
  }

  recompute(): void {
    this.data = this.dashboardCalc.computeMonthly(
      this.selectedMonth,
      this.transactionService.getAll(),
      this.categoryService.getSubcategories(),
      this.categoryService.getCategories(),
      this.hideTransfers,
    );
    this.cdr.markForCheck();
  }
}
