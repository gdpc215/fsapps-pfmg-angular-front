import { Component, inject, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { AccountService } from '../../../../logic/services/account.service';
import { CategoryService } from '../../../../logic/services/category.service';
import { CurrencyService } from '../../../../logic/services/currency.service';
import { MovementService } from '../../../../logic/services/movement.service';
import { RecurrentTransactionService } from '../../../../logic/services/recurrent-transaction.service';
import { Account } from '../../../../logic/types/account';
import { Category } from '../../../../logic/types/category';
import { Currency } from '../../../../logic/types/currency';
import { ExecutionMode, RecurrenceType, RecurrentTransaction } from '../../../../logic/types/recurrent-transaction';
import { TransactionType } from '../../../../logic/types/transaction';
import { RecurrentTransactionDialogComponent } from './recurrent-transaction-dialog/recurrent-transaction-dialog.component';

@Component({
  selector: 'app-recurrent-transactions',
  templateUrl: './recurrent-transactions.component.html',
  standalone: false
})
export class RecurrentTransactionsComponent implements OnInit {
  private recurrentTransactionService = inject(RecurrentTransactionService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private currencyService = inject(CurrencyService);
  private movementService = inject(MovementService);

  recurrentTransactions$!: Observable<RecurrentTransaction[]>;
  accounts: Account[] = [];
  categories: Category[] = [];
  currencies: Currency[] = [];
  
  RecurrenceType = RecurrenceType;
  TransactionType = TransactionType;
  ExecutionMode = ExecutionMode;

  constructor(private dialog: MatDialog) {}

  ngOnInit(): void {
    this.recurrentTransactions$ = this.recurrentTransactionService.getRecurrentTransactions();
    
    this.accountService.getAccounts().subscribe(accounts => {
      this.accounts = accounts;
    });
    
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
    
    this.currencyService.getCurrencies().subscribe(currencies => {
      this.currencies = currencies;
    });

    // Check and execute any due transactions
    this.checkAndExecuteDueTransactions();
  }

  getAccountName(accountId: string): string {
    const account = this.accounts.find(a => a.id === accountId);
    return account ? account.name : 'Unknown Account';
  }

  getCategoryName(categoryId: string | null): string {
    if (!categoryId) return 'Uncategorized';
    const category = this.categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  }

  getCurrencySymbol(currencyId: string): string {
    const currency = this.currencies.find(c => c.id === currencyId);
    return currency ? currency.symbol : '';
  }

  getRecurrenceDescription(rt: RecurrentTransaction): string {
    if (rt.recurrenceType === RecurrenceType.DAY_OF_MONTH) {
      return `Day ${rt.dayOfMonth} of each month`;
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[(rt.month || 1) - 1];
      return `${month} ${rt.dayOfYear} each year`;
    }
  }

  getNextExecutionDisplay(date: Date | null): string {
    if (!date) return 'Not scheduled';
    return new Date(date).toLocaleDateString();
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(RecurrentTransactionDialogComponent, {
      width: '600px',
      data: {
        recurrentTransaction: null,
        accounts: this.accounts,
        categories: this.categories,
        currencies: this.currencies
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.recurrentTransactionService.addRecurrentTransaction(result);
      }
    });
  }

  openEditDialog(rt: RecurrentTransaction): void {
    const dialogRef = this.dialog.open(RecurrentTransactionDialogComponent, {
      width: '600px',
      data: {
        recurrentTransaction: { ...rt },
        accounts: this.accounts,
        categories: this.categories,
        currencies: this.currencies
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.recurrentTransactionService.updateRecurrentTransaction(result);
      }
    });
  }

  deleteRecurrentTransaction(rt: RecurrentTransaction): void {
    if (confirm(`Are you sure you want to delete "${rt.name}"?`)) {
      this.recurrentTransactionService.deleteRecurrentTransaction(rt.id);
    }
  }

  toggleActive(rt: RecurrentTransaction): void {
    this.recurrentTransactionService.toggleActive(rt.id);
  }

  executeNow(rt: RecurrentTransaction): void {
    if (confirm(`Execute "${rt.name}" now?`)) {
      const transaction = this.recurrentTransactionService.toTransaction(rt);
      this.movementService.addMovement(transaction);
      this.recurrentTransactionService.markAsExecuted(rt.id);
    }
  }

  skipNextOccurrence(rt: RecurrentTransaction): void {
    if (confirm(`Skip the next occurrence of "${rt.name}"? It will not execute during the current period.`)) {
      this.recurrentTransactionService.skipNextOccurrence(rt.id);
    }
  }

  getTimeRemainingDisplay(rt: RecurrentTransaction): string {
    const timeInfo = this.recurrentTransactionService.getTimeRemaining(rt);
    
    if (timeInfo.isOverdue) {
      if (timeInfo.days > 0) {
        return `Overdue by ${timeInfo.days}d ${timeInfo.hours}h`;
      }
      return `Overdue by ${timeInfo.hours}h ${timeInfo.minutes}m`;
    }
    
    if (timeInfo.days > 0) {
      return `${timeInfo.days}d ${timeInfo.hours}h`;
    }
    return `${timeInfo.hours}h ${timeInfo.minutes}m`;
  }

  isCurrentlySkipped(rt: RecurrentTransaction): boolean {
    if (!rt.skippedUntil) return false;
    return new Date(rt.skippedUntil) > new Date();
  }

  private checkAndExecuteDueTransactions(): void {
    const dueTransactions = this.recurrentTransactionService.getDueTransactions();
    
    if (dueTransactions.length > 0) {
      const message = `${dueTransactions.length} recurrent transaction(s) are due. Execute them now?`;
      if (confirm(message)) {
        dueTransactions.forEach(rt => {
          const transaction = this.recurrentTransactionService.toTransaction(rt);
          this.movementService.addMovement(transaction);
          this.recurrentTransactionService.markAsExecuted(rt.id);
        });
      }
    }
  }
}
