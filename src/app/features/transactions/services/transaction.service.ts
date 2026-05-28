import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Transaction } from '../../../core/models/transaction.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly _transactions$ = new BehaviorSubject<Transaction[]>([]);
  readonly transactions$: Observable<Transaction[]> = this._transactions$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): Transaction[] { return this._transactions$.getValue(); }

  getActive(): Transaction[] {
    return this.getAll().filter(t => t.strStatus === 'ACTIVE');
  }

  getNonDeleted(): Transaction[] {
    return this.getAll().filter(t => t.strStatus !== 'DELETED');
  }

  getByAccount(accountId: string): Transaction[] {
    return this.getAll().filter(t => t.accountId === accountId);
  }

  getActiveByCardAndDateRange(cardId: string, from: string, to: string): Transaction[] {
    return this.getActive().filter(
      t => t.accountId === cardId && t.dateTransaction >= from && t.dateTransaction <= to
    );
  }

  save(transaction: Partial<Transaction>): Transaction {
    const record = { strStatus: 'ACTIVE' as const, ...transaction } as Transaction;
    return this.storage.save<Transaction>(STORAGE_KEYS.TRANSACTIONS, record);
  }

  saveMany(transactions: Partial<Transaction>[]): Transaction[] {
    const all = this.storage.getAll<Transaction>(STORAGE_KEYS.TRANSACTIONS);
    const now = new Date().toISOString();
    const saved: Transaction[] = transactions.map(t => ({
      strStatus: 'ACTIVE' as const,
      ...t,
      id: crypto.randomUUID(),
      dateCreation: now,
      dateModification: now,
    } as Transaction));
    this.storage.saveAll<Transaction>(STORAGE_KEYS.TRANSACTIONS, [...all, ...saved]);
    return saved;
  }

  softDelete(id: string): void {
    const t = this.getAll().find(x => x.id === id);
    if (t) this.storage.save<Transaction>(STORAGE_KEYS.TRANSACTIONS, { ...t, strStatus: 'DELETED' });
  }

  clearSubcategoryRef(subcategoryId: string): void {
    const all = this.getAll();
    const updated = all.map(t =>
      t.subcategoryId === subcategoryId ? { ...t, subcategoryId: undefined } : t
    );
    this.storage.saveAll<Transaction>(STORAGE_KEYS.TRANSACTIONS, updated);
  }

  private refresh(): void {
    this._transactions$.next(this.storage.getAll<Transaction>(STORAGE_KEYS.TRANSACTIONS));
  }
}
