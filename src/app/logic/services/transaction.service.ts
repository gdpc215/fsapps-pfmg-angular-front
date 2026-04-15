import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Transaction } from '../types/transaction';
import { Utilities } from '../utilities';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private transactions$ = new BehaviorSubject<Transaction[]>([]);

  constructor(private storageService: StorageService) {
    this.load();
  }

  getTransactions(): Observable<Transaction[]> {
    return this.transactions$.asObservable();
  }

  getCurrentTransactions(): Transaction[] {
    return this.transactions$.value;
  }

  getBySource(sourceId: string): Transaction[] {
    return this.transactions$.value.filter((t) => t.sourceId === sourceId);
  }

  getInRange(sourceId: string, fromDate: string, toDate: string): Transaction[] {
    const from = new Date(fromDate).getTime();
    const to = new Date(toDate).getTime();
    return this.transactions$.value.filter((t) => {
      if (t.sourceId !== sourceId) {
        return false;
      }
      const txDate = new Date(t.date).getTime();
      return txDate >= from && txDate <= to;
    });
  }

  addTransaction(transaction: Transaction): void {
    transaction.id = Utilities.generateUUID();
    this.save([...this.transactions$.value, transaction]);
  }

  addTransactions(transactions: Transaction[]): void {
    const incoming = transactions.map((t) => {
      const tx = new Transaction();
      Object.assign(tx, t);
      tx.id = Utilities.generateUUID();
      return tx;
    });
    this.save([...this.transactions$.value, ...incoming]);
  }

  updateTransaction(transaction: Transaction): void {
    this.save(this.transactions$.value.map((t) => t.id === transaction.id ? transaction : t));
  }

  deleteTransaction(id: string): void {
    this.save(this.transactions$.value.filter((t) => t.id !== id));
  }

  clearAll(): void {
    this.save([]);
  }

  private load(): void {
    const cached = this.storageService.get<Transaction[]>(Constants.StorageTags.TRANSACTIONS) || [];
    this.transactions$.next(cached);
  }

  private save(transactions: Transaction[]): void {
    this.storageService.set(Constants.StorageTags.TRANSACTIONS, transactions);
    this.transactions$.next(transactions);
  }
}
