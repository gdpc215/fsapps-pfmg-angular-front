import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Currency } from '../types/currency';
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

  getInRange(sourceId: string, fromDate: Date, toDate: Date): Transaction[] {
    const from = fromDate.getTime();
    const to = toDate.getTime();
    return this.transactions$.value.filter((t) => {
      if (t.sourceId !== sourceId) {
        return false;
      }
      const txDate = new Date(t.date).getTime();
      return txDate >= from && txDate <= to;
    });
  }

  addTransaction(transaction: Transaction): void {
    const normalized = this.normalizeTransaction(transaction);
    normalized.id = Utilities.generateUUID();
    this.save([...this.transactions$.value, normalized]);
  }

  addTransactions(transactions: Transaction[]): void {
    const incoming = transactions.map((t) => {
      const tx = new Transaction();
      Object.assign(tx, t);
      const normalized = this.normalizeTransaction(tx);
      normalized.id = Utilities.generateUUID();
      return normalized;
    });
    this.save([...this.transactions$.value, ...incoming]);
  }

  updateTransaction(transaction: Transaction): void {
    const normalized = this.normalizeTransaction(transaction);
    this.save(this.transactions$.value.map((t) => t.id === transaction.id ? normalized : t));
  }

  deleteTransaction(id: string): void {
    this.save(this.transactions$.value.filter((t) => t.id !== id));
  }

  clearAll(): void {
    this.save([]);
  }

  private load(): void {
    const cached = this.storageService.get<Transaction[]>(Constants.StorageTags.TRANSACTIONS) || [];
    const normalized = cached.map((tx) => this.normalizeTransaction(tx));
    this.transactions$.next(normalized);

    const requiresMigration = cached.some((tx) => {
      const currencyCode = (tx.currency || 'PEN').toString().toUpperCase();
      if (currencyCode === 'PEN') {
        return typeof tx.amountPen !== 'number' || Math.abs((tx.amountPen ?? 0) - tx.amount) > 0.01;
      }
      return typeof tx.amountPen !== 'number' || !Number.isFinite(tx.amountPen);
    });

    if (requiresMigration) {
      this.storageService.set(Constants.StorageTags.TRANSACTIONS, normalized);
    }
  }

  private normalizeTransaction(input: Transaction): Transaction {
    const tx = new Transaction();
    Object.assign(tx, input);

    const currencies = this.storageService.get<Currency[]>(Constants.StorageTags.CURRENCIES) || [];
    const currencyCode = this.normalizeCurrencyCode(tx.currency, currencies);
    tx.currency = currencyCode;

    if (currencyCode === 'PEN') {
      tx.amountPen = tx.amount;
      tx.exchangeRate = undefined;
      return tx;
    }

    const rate = this.resolvePenRate(currencyCode, tx.exchangeRate, currencies);
    tx.amountPen = tx.amount * (rate ?? 1);
    if (rate) {
      tx.exchangeRate = rate;
    }

    return tx;
  }

  private resolvePenRate(currencyCode: string, explicitRate?: number, currencies?: Currency[]): number | null {
    if (Number.isFinite(explicitRate) && (explicitRate as number) > 0) {
      return explicitRate as number;
    }

    const configuredCurrencies = currencies || this.storageService.get<Currency[]>(Constants.StorageTags.CURRENCIES) || [];
    const currency = configuredCurrencies.find((item) => item.code?.toUpperCase() === currencyCode.toUpperCase());
    if (!currency) {
      return null;
    }

    return Number.isFinite(currency.conversionRate) && currency.conversionRate > 0
      ? currency.conversionRate
      : null;
  }

  private normalizeCurrencyCode(rawValue: unknown, currencies: Currency[]): string {
    const raw = String(rawValue ?? '').trim();
    if (!raw) {
      return 'PEN';
    }

    const byCode = currencies.find((item) => item.code?.toUpperCase() === raw.toUpperCase());
    if (byCode?.code) {
      return byCode.code.toUpperCase();
    }

    const bySymbol = currencies.find((item) => item.symbol === raw);
    if (bySymbol?.code) {
      return bySymbol.code.toUpperCase();
    }

    const byId = currencies.find((item) => item.id === raw);
    if (byId?.code) {
      return byId.code.toUpperCase();
    }

    const extractedLetters = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (extractedLetters.length === 3) {
      const byLetters = currencies.find((item) => item.code?.toUpperCase() === extractedLetters);
      if (byLetters?.code) {
        return byLetters.code.toUpperCase();
      }
    }

    return raw.toUpperCase();
  }

  private save(transactions: Transaction[]): void {
    this.storageService.set(Constants.StorageTags.TRANSACTIONS, transactions);
    this.transactions$.next(transactions);
  }
}
