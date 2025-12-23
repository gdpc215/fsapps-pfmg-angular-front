import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Account } from '../types/account';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class AccountService extends BaseService {

  private accounts$ = new BehaviorSubject<Account[]>([]);

  constructor() {
    super('AccountService');
    this.loadFromCache();
  }

  getAccounts(): Observable<Account[]> {
    return this.accounts$.asObservable();
  }

  getAccountById(id: string): Account | undefined {
    return this.accounts$.value.find(a => a.id === id);
  }

  addAccount(account: Account): void {
    account.id = Utilities.generateUUID();
    // Initialize currentBalance from initialBalance
    account.currentBalance = account.initialBalance;
    const accounts = [...this.accounts$.value, account];
    this.saveToCache(accounts);
  }

  updateAccount(account: Account): void {
    const oldAccount = this.accounts$.value.find(a => a.id === account.id);
    
    // If initialBalance changed, recalculate currentBalance
    if (oldAccount && oldAccount.initialBalance !== account.initialBalance) {
      const balanceDifference = account.initialBalance - oldAccount.initialBalance;
      account.currentBalance = oldAccount.currentBalance + balanceDifference;
    }
    
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

  private loadFromCache(): void {
    const cached = this.fetchFromLocalStorage<Account[]>(Constants.StorageTags.ACCOUNTS);
    this.accounts$.next(cached || []);
  }

  private saveToCache(accounts: Account[]): void {
    this.storeInLocalStorage(accounts, Constants.StorageTags.ACCOUNTS);
    this.accounts$.next(accounts);
  }
}
