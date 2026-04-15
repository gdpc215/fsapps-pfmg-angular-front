import { Injectable } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { Account, AccountType } from '../types/account';
import { BalanceSnapshot } from '../types/balance-snapshot';
import { FinancialSource, FinancialSourceType } from '../types/financial-source';
import { BalanceService } from './balance.service';
import { FinancialSourceService } from './financial-source.service';
import { SnapshotService } from './snapshot.service';

@Injectable({ providedIn: 'root' })
export class AccountService {
  constructor(
    private sourceService: FinancialSourceService,
    private balanceService: BalanceService,
    private snapshotService: SnapshotService
  ) {}

  getAccounts(): Observable<Account[]> {
    return combineLatest([
      this.sourceService.getSources(),
      this.balanceService.changes$
    ]).pipe(
      map(([sources]) => sources.map((source) => this.toAccount(source)))
    );
  }

  getAccountById(id: string): Account | undefined {
    const source = this.sourceService.getById(id);
    return source ? this.toAccount(source) : undefined;
  }

  addAccount(account: Account): void {
    const source = this.toSource(account);
    this.sourceService.addSource(source);

    if (account.initialBalance !== 0) {
      const snapshot = new BalanceSnapshot();
      snapshot.sourceId = source.id;
      snapshot.currency = (account.currencyId as 'PEN' | 'USD') || 'PEN';
      snapshot.balance = account.initialBalance;
      // Use a very early date so it precedes all future transactions
      snapshot.datetime = new Date('2000-01-01T00:00:00.000Z').toISOString();
      this.snapshotService.addSnapshot(snapshot);
    }
  }

  updateAccount(account: Account): void {
    const source = this.toSource(account);
    this.sourceService.updateSource(source);
  }

  deleteAccount(id: string): void {
    this.sourceService.deleteSource(id);
  }

  // Balances are now derived from snapshots + transactions.
  getComputedBalance(accountId: string): number {
    return this.balanceService.getCurrentBalance(accountId);
  }

  // Legacy no-op to avoid mutating source state.
  setCheckpoint(_id: string, _balance: number): void {
    return;
  }

  // Legacy no-op to avoid mutable balance updates.
  updateBalance(_accountId: string, _amountChange: number): void {
    return;
  }

  // Legacy no-op kept for compatibility.
  recalculateBalance(_accountId: string, _totalMovementsAmount: number): void {
    return;
  }

  private toAccount(source: FinancialSource): Account {
    const account = new Account();
    account.id = source.id;
    account.name = source.name;
    account.type = source.type === FinancialSourceType.CREDIT_CARD ? AccountType.CREDIT : AccountType.DEBIT;
    account.currencyId = source.currency || 'PEN';
    account.color = source.color || '#ba68c8';
    account.billingDate = source.closingDay;
    account.paymentDate = source.dueDay;
    account.creditLimit = source.creditLinePen;
    account.currentBalance = this.balanceService.getCurrentBalance(source.id);
    account.initialBalance = 0;
    account.lastCheckpointBalance = 0;
    account.lastCheckpointDate = null;
    return account;
  }

  private toSource(account: Account): FinancialSource {
    const source = new FinancialSource();
    source.id = account.id;
    source.name = account.name;
    source.type = account.type === AccountType.CREDIT
      ? FinancialSourceType.CREDIT_CARD
      : FinancialSourceType.ACCOUNT;
    source.currency = account.currencyId as 'PEN' | 'USD';
    source.color = account.color;
    source.closingDay = account.billingDate;
    source.dueDay = account.paymentDate;
    source.creditLinePen = account.creditLimit;
    return source;
  }
}
