import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CreditCardService } from '../../../credit-cards/services/credit-card.service';
import { TransactionService } from '../../../transactions/services/transaction.service';
import { ImportBatchService } from '../../../import/services/import-batch.service';
import { CategoryService } from '../../../categories/services/category.service';
import { DashboardCalculatorService, CycleDashboardCardData } from '../../../../core/services/dashboard-calculator.service';

@Component({
  selector: 'app-cycle-dashboard',
  standalone: false,
  templateUrl: './cycle-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CycleDashboardComponent implements OnInit, OnDestroy {
  cardSummaries: CycleDashboardCardData[] = [];
  todayDate: string = new Date().toISOString().slice(0, 10);
  private sub?: Subscription;

  constructor(
    private creditCardService: CreditCardService,
    private transactionService: TransactionService,
    private importBatchService: ImportBatchService,
    private categoryService: CategoryService,
    private dashboardCalc: DashboardCalculatorService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.recompute();
    this.sub = this.transactionService.transactions$.subscribe(() => this.recompute());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  recompute(): void {
    const cards   = this.creditCardService.getAll();
    const txns    = this.transactionService.getAll();
    const batches = this.importBatchService.getAll();
    const subs    = this.categoryService.getSubcategories();
    const cats    = this.categoryService.getCategories();

    this.cardSummaries = cards.map(card =>
      this.dashboardCalc.computeCycleSummary(card, this.todayDate, txns, batches, subs, cats)
    );
    this.cdr.markForCheck();
  }
}
