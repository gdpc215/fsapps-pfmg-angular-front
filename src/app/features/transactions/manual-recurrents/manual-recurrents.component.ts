import { Component, inject, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AccountService } from '../../../logic/services/account.service';
import { CategoryService } from '../../../logic/services/category.service';
import { CurrencyService } from '../../../logic/services/currency.service';
import { MovementService } from '../../../logic/services/movement.service';
import { RecurrentTransactionService } from '../../../logic/services/recurrent-transaction.service';
import { Account } from '../../../logic/types/account';
import { Category } from '../../../logic/types/category';
import { Currency } from '../../../logic/types/currency';
import { ExecutionMode, RecurrentTransaction } from '../../../logic/types/recurrent-transaction';
import { TransactionType } from '../../../logic/types/transaction';

@Component({
  selector: 'app-manual-recurrents',
  templateUrl: './manual-recurrents.component.html',
  standalone: false
})
export class ManualRecurrentsComponent implements OnInit {
  private recurrentTransactionService = inject(RecurrentTransactionService);
  private accountService = inject(AccountService);
  private categoryService = inject(CategoryService);
  private currencyService = inject(CurrencyService);
  private movementService = inject(MovementService);

  dueManualTransactions$!: Observable<RecurrentTransaction[]>;
  accounts: Account[] = [];
  categories: Category[] = [];
  currencies: Currency[] = [];
  selectedTransactions = new Set<string>();
  
  TransactionType = TransactionType;
  ExecutionMode = ExecutionMode;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.dueManualTransactions$ = this.recurrentTransactionService.getRecurrentTransactions().pipe(
      map(transactions => {
        const due = this.recurrentTransactionService.getDueManualTransactions();
        return due;
      })
    );
    
    this.accountService.getAccounts().subscribe(accounts => {
      this.accounts = accounts;
    });
    
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
    });
    
    this.currencyService.getCurrencies().subscribe(currencies => {
      this.currencies = currencies;
    });
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

  getTimeRemainingDisplay(rt: RecurrentTransaction): string {
    const timeInfo = this.recurrentTransactionService.getTimeRemaining(rt);
    
    if (timeInfo.isPastMax) {
      return 'Expired';
    }
    
    if (timeInfo.isOverdue) {
      if (timeInfo.days > 0) {
        return `Overdue by ${timeInfo.days}d ${timeInfo.hours}h`;
      }
      return `Overdue by ${timeInfo.hours}h ${timeInfo.minutes}m`;
    }
    
    if (timeInfo.days > 0) {
      return `${timeInfo.days}d ${timeInfo.hours}h remaining`;
    }
    return `${timeInfo.hours}h ${timeInfo.minutes}m remaining`;
  }

  isOverdue(rt: RecurrentTransaction): boolean {
    return this.recurrentTransactionService.getTimeRemaining(rt).isOverdue;
  }

  isPastMax(rt: RecurrentTransaction): boolean {
    return this.recurrentTransactionService.getTimeRemaining(rt).isPastMax;
  }

  toggleSelection(id: string): void {
    if (this.selectedTransactions.has(id)) {
      this.selectedTransactions.delete(id);
    } else {
      this.selectedTransactions.add(id);
    }
  }

  toggleAll(event: Event): void {
    event.preventDefault();
    this.dueManualTransactions$.subscribe(transactions => {
      const validTransactions = transactions.filter(rt => !this.isPastMax(rt));
      const allSelected = validTransactions.every(rt => this.selectedTransactions.has(rt.id));
      
      if (allSelected) {
        validTransactions.forEach(rt => this.selectedTransactions.delete(rt.id));
      } else {
        validTransactions.forEach(rt => this.selectedTransactions.add(rt.id));
      }
    }).unsubscribe();
  }

  isCurrentlySkipped(rt: RecurrentTransaction): boolean {
    if (!rt.skippedUntil) return false;
    return new Date(rt.skippedUntil) > new Date();
  }

  submitSelected(): void {
    const count = this.selectedTransactions.size;
    if (count === 0) return;
    
    if (confirm(`Execute ${count} selected transaction(s)?`)) {
      this.selectedTransactions.forEach(id => {
        const rt = this.recurrentTransactionService['recurrentTransactions$'].value.find(t => t.id === id);
        if (rt) {
          const transaction = this.recurrentTransactionService.toTransaction(rt);
          this.movementService.addMovement(transaction);
          this.recurrentTransactionService.markAsExecuted(rt.id);
        }
      });
      
      this.selectedTransactions.clear();
      this.loadData(); // Refresh list
    }
  }

  skipOccurrence(rt: RecurrentTransaction, event: Event): void {
    event.stopPropagation();
    
    if (confirm(`Skip the next occurrence of "${rt.name}"?`)) {
      this.recurrentTransactionService.skipNextOccurrence(rt.id);
      this.loadData(); // Refresh list
    }
  }

  executeNow(rt: RecurrentTransaction, event: Event): void {
    event.stopPropagation();
    
    if (confirm(`Execute "${rt.name}" now?`)) {
      const transaction = this.recurrentTransactionService.toTransaction(rt);
      this.movementService.addMovement(transaction);
      this.recurrentTransactionService.markAsExecuted(rt.id);
      this.selectedTransactions.delete(rt.id);
      this.loadData(); // Refresh list
    }
  }
}
