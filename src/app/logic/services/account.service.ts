import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Account, AccountType } from '../types/account';
import { CardBalanceSnapshot } from '../types/card-balance-snapshot';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';
import { CardBalanceSnapshotService } from './card-balance-snapshot.service';

@Injectable({ providedIn: 'root' })
export class AccountService extends BaseService {
  private accounts$ = new BehaviorSubject<Account[]>([]);

  constructor(
    private cardBalanceSnapshotService: CardBalanceSnapshotService
  ) {
    super('AccountService');
    this.loadFromCache();
  }

  getAccounts(): Observable<Account[]> {
    return this.accounts$.asObservable();
  }

  getAccountsSync(): Account[] {
    return this.accounts$.value;
  }

  getAccountById(id: string): Account | undefined {
    return this.accounts$.value.find(a => a.id === id);
  }

  addAccount(account: Account): void {
    account.id = Utilities.generateUUID();
    account.currentBalance = account.initialBalance;

    // For credit cards with initial balance, create an owed snapshot
    if (account.type === AccountType.CREDIT && account.initialBalance !== 0) {
      const cardSnapshot = new CardBalanceSnapshot();
      cardSnapshot.accountId = account.id;
      cardSnapshot.snapshotDate = new Date();
      cardSnapshot.owedAmount = account.initialBalance;
      cardSnapshot.notes = 'Initial card balance snapshot';
      this.cardBalanceSnapshotService.addSnapshot(cardSnapshot);
    }

    const accounts = [...this.accounts$.value, account];
    this.saveToCache(accounts);
  }

  updateAccount(account: Account): void {
    const accounts = this.accounts$.value.map(a =>
      a.id === account.id ? account : a
    );
    this.saveToCache(accounts);
  }

  deleteAccount(id: string): void {
    const accounts = this.accounts$.value.filter(a => a.id !== id);
    this.saveToCache(accounts);
  }

  setCheckpoint(id: string, balance: number): void {
    const accounts = this.accounts$.value.map(a => {
      if (a.id === id) {
        const updated = Object.assign(new Account(), a);
        updated.lastCheckpointBalance = balance;
        updated.lastCheckpointDate = new Date();
        return updated;
      }
      return a;
    });
    this.saveToCache(accounts);
  }

  updateBalance(accountId: string, amountChange: number): void {
    const accounts = this.accounts$.value.map(a => {
      if (a.id === accountId) {
        const updated = Object.assign(new Account(), a);
        updated.currentBalance += amountChange;
        return updated;
      }
      return a;
    });
    this.saveToCache(accounts);
  }

  recalculateBalance(accountId: string, totalMovementsAmount: number): void {
    const accounts = this.accounts$.value.map(a => {
      if (a.id === accountId) {
        const updated = Object.assign(new Account(), a);
        updated.currentBalance = a.initialBalance + totalMovementsAmount;
        return updated;
      }
      return a;
    });
    this.saveToCache(accounts);
  }

  getComputedBalance(accountId: string): number {
    return this.accounts$.value.find(a => a.id === accountId)?.currentBalance ?? 0;
  }

  seedDefaultAccounts(): void {
    // Debit account 1 — main checking account
    const checking = new Account();
    checking.name = 'Tarjeta Debito';
    checking.type = AccountType.DEBIT;
    checking.color = '#42a5f5';
    checking.currencyId = 'PEN';
    checking.initialBalance = 316.57;

    // Debit account 2 — savings account
    const savings = new Account();
    savings.name = 'Sueldo';
    savings.type = AccountType.DEBIT;
    savings.color = '#66bb6a';
    savings.currencyId = 'PEN';
    savings.initialBalance = 4493.95;

    // Credit card account
    const creditCard = new Account();
    creditCard.name = 'Visa Sapphire';
    creditCard.type = AccountType.CREDIT;
    creditCard.color = '#341251';
    creditCard.currencyId = 'PEN';
    creditCard.paymentCurrencyId = 'PEN';
    creditCard.initialBalance = 22470.98;
    creditCard.creditLimit = 80000;
    creditCard.billingDate = 10;
    creditCard.paymentDate = 5;

    [checking, savings, creditCard].forEach(account => this.addAccount(account));
  }

  private loadFromCache(): void {
    const cached = this.fetchFromLocalStorage<Account[]>(Constants.StorageTags.ACCOUNTS);
    this.accounts$.next(cached || []);
  }

  private saveToCache(accounts: Account[]): void {
    this.storeInLocalStorage(accounts, Constants.StorageTags.ACCOUNTS);
    this.accounts$.next(accounts);
  }
}
