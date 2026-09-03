import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';
import { ImportBatch } from '../models/import-batch.model';
import { Category, Subcategory } from '../models/category.model';
import { CreditCard } from '../models/credit-card.model';
import { ConciliationCalculatorService, CycleWindow } from './conciliation-calculator.service';

export interface SubcategoryTotal {
  subcategoryId: string;
  subcategoryName: string;
  categoryName: string;
  total: number;
}

export interface MonthlyDashboardData {
  month: string;
  totalIncome: number;
  totalExpenses: number;
  netAmount: number;
  bySubcategory: SubcategoryTotal[];
  uncategorizedIncome: number;
  uncategorizedExpenses: number;
  pendingCount: number;
  pendingTotal: number;
}

export interface CycleDashboardCardData {
  card: CreditCard;
  cycleWindow: CycleWindow;
  totalExpenses: number;
  totalPayments: number;
  transactionCount: number;
  topSubcategories: SubcategoryTotal[];
  balanceAtLastImport: number;
  balanceImportDate: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardCalculatorService {

  constructor(private conciliationCalculator: ConciliationCalculatorService) {}

  /** Balance derived from the latest import batch for the account. */
  computeCurrentBalance(accountId: string, importBatches: ImportBatch[]): {
    balance: number; importDate: string | undefined
  } {
    const latest = importBatches
      .filter(b => b.accountId === accountId)
      .sort((a, b) => b.dateImport.localeCompare(a.dateImport))[0];
    return {
      balance:    latest?.decBalanceAtImport ?? 0,
      importDate: latest?.dateImport,
    };
  }

  computeMonthly(
    month: string,
    transactions: Transaction[],
    subcategories: Subcategory[],
    categories: Category[],
    hideTransfers = false
  ): MonthlyDashboardData {
    let inMonth = transactions.filter(
      t => t.strStatus !== 'DELETED' && t.dateTransaction.startsWith(month)
    );

    if (hideTransfers) {
      inMonth = inMonth.filter(t => t.transferGroupId == null);
    }

    const totalIncome   = inMonth.filter(t => t.decAmountPen > 0).reduce((s, t) => s + t.decAmountPen, 0);
    const totalExpenses = inMonth.filter(t => t.decAmountPen < 0).reduce((s, t) => s + t.decAmountPen, 0);

    const pending      = inMonth.filter(t => t.strStatus === 'PENDING');
    const pendingCount = pending.length;
    const pendingTotal = pending.reduce((s, t) => s + t.decAmountPen, 0);

    const categorized   = inMonth.filter(t => t.subcategoryId != null);
    const uncategorized = inMonth.filter(t => t.subcategoryId == null);

    return {
      month,
      totalIncome,
      totalExpenses,
      netAmount: totalIncome + totalExpenses,
      bySubcategory: this.groupBySubcategory(categorized, subcategories, categories),
      uncategorizedIncome:   uncategorized.filter(t => t.decAmountPen > 0).reduce((s, t) => s + t.decAmountPen, 0),
      uncategorizedExpenses: uncategorized.filter(t => t.decAmountPen < 0).reduce((s, t) => s + t.decAmountPen, 0),
      pendingCount,
      pendingTotal,
    };
  }

  computeCycleSummary(
    card: CreditCard,
    todayDate: string,
    transactions: Transaction[],
    importBatches: ImportBatch[],
    subcategories: Subcategory[],
    categories: Category[]
  ): CycleDashboardCardData {
    const cycleWindow = this.conciliationCalculator.buildCycleWindow(card.intClosingDay, todayDate);

    const cycleTxns = transactions.filter(
      t => t.strStatus !== 'DELETED' &&     // includes PENDING (consistent with monthly)
           t.accountId === card.id &&
           t.dateTransaction >= cycleWindow.cycleStart &&
           t.dateTransaction <= cycleWindow.closingDate
    );

    const totalExpenses = Math.abs(cycleTxns.filter(t => t.decAmountPen < 0).reduce((s, t) => s + t.decAmountPen, 0));
    const totalPayments =           cycleTxns.filter(t => t.decAmountPen > 0).reduce((s, t) => s + t.decAmountPen, 0);

    const bySub = this.groupBySubcategory(cycleTxns.filter(t => t.subcategoryId != null), subcategories, categories);
    const topSubcategories = [...bySub]
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.subcategoryName.localeCompare(b.subcategoryName))
      .slice(0, 3);

    const { balance: balanceAtLastImport, importDate: balanceImportDate } =
      this.computeCurrentBalance(card.id, importBatches);

    return {
      card, cycleWindow, totalExpenses, totalPayments,
      transactionCount: cycleTxns.length,
      topSubcategories,
      balanceAtLastImport,
      balanceImportDate: balanceImportDate ?? '',
    };
  }

  private groupBySubcategory(
    transactions: Transaction[],
    subcategories: Subcategory[],
    categories: Category[]
  ): SubcategoryTotal[] {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (!t.subcategoryId) continue;
      map.set(t.subcategoryId, (map.get(t.subcategoryId) ?? 0) + t.decAmountPen);
    }
    return Array.from(map.entries())
      .map(([id, total]) => {
        const sub = subcategories.find(s => s.id === id);
        const cat = sub ? categories.find(c => c.id === sub.categoryId) : undefined;
        return { subcategoryId: id, subcategoryName: sub?.strName ?? '(unknown)', categoryName: cat?.strName ?? '(unknown)', total };
      })
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total) || a.subcategoryName.localeCompare(b.subcategoryName));
  }
}
