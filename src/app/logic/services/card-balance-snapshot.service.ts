import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { CardBalanceSnapshot } from '../types/card-balance-snapshot';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';
import { TransactionService } from './transaction.service';

@Injectable({ providedIn: 'root' })
export class CardBalanceSnapshotService extends BaseService {

  private snapshots$ = new BehaviorSubject<CardBalanceSnapshot[]>([]);

  constructor(private transactionService: TransactionService) {
    super('CardBalanceSnapshotService');
    this.loadFromCache();
  }

  getSnapshots(): Observable<CardBalanceSnapshot[]> {
    return this.snapshots$.asObservable();
  }

  getSnapshotsByAccountId(accountId: string): CardBalanceSnapshot[] {
    return this.snapshots$.value
      .filter(s => s.accountId === accountId)
      .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());
  }

  getSnapshotById(id: string): CardBalanceSnapshot | undefined {
    return this.snapshots$.value.find(s => s.id === id);
  }

  getLatestSnapshotBeforeOrOn(accountId: string, date: string): CardBalanceSnapshot | null {
    const targetTime = new Date(date).getTime();
    const matches = this.snapshots$.value
      .filter(s => s.accountId === accountId && new Date(s.snapshotDate).getTime() <= targetTime)
      .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());

    return matches.length > 0 ? matches[0] : null;
  }

  /**
   * Calculate the current owed amount based on the latest snapshot and movements since that snapshot.
   * Returns: latestSnapshot.owedAmount + sum of movements after the snapshot
   */
  getCurrentOwedAmount(accountId: string): number {
    const snapshots = this.getSnapshotsByAccountId(accountId);
    if (snapshots.length === 0) {
      return 0;
    }

    const latestSnapshot = snapshots[0]; // Already sorted by date descending
    const snapshotDate = new Date(latestSnapshot.snapshotDate);
    snapshotDate.setDate(snapshotDate.getDate() + 1); // Start from next day

    const movements = this.transactionService.getBySource(accountId);
    const movementsSinceSnapshot = movements
      .filter(m => new Date(m.date).getTime() >= snapshotDate.getTime())
      .reduce((sum, m) => sum + (m.amountPen ?? m.amount), 0);

    return latestSnapshot.owedAmount + (latestSnapshot.delta ?? 0) + movementsSinceSnapshot;
  }

  addSnapshot(snapshot: Omit<CardBalanceSnapshot, 'id' | 'createdAt' | 'updatedAt' | 'delta'> & { delta?: number }): void {
    const now = new Date();
    const newSnapshot: CardBalanceSnapshot = {
      ...snapshot,
      delta: snapshot.delta ?? 0,
      id: Utilities.generateUUID(),
      createdAt: now,
      updatedAt: now
    };

    const snapshots = [...this.snapshots$.value, newSnapshot];
    this.saveToCache(snapshots);
  }

  updateSnapshot(snapshot: CardBalanceSnapshot): void {
    const snapshots = this.snapshots$.value.map(s =>
      s.id === snapshot.id
        ? {
            ...snapshot,
            delta: snapshot.delta ?? 0,
            createdAt: s.createdAt,
            updatedAt: new Date()
          }
        : s
    );

    this.saveToCache(snapshots);
  }

  deleteSnapshot(id: string): void {
    const snapshots = this.snapshots$.value.filter(s => s.id !== id);
    this.saveToCache(snapshots);
  }

  private loadFromCache(): void {
    const cached = this.fetchFromLocalStorage<CardBalanceSnapshot[]>(Constants.StorageTags.CARD_BALANCE_SNAPSHOTS) || [];

    const parsed = cached.map(snapshot => ({
      ...snapshot,
      delta: snapshot.delta ?? 0,
      snapshotDate: new Date(snapshot.snapshotDate),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt)
    }));

    this.snapshots$.next(parsed);
  }

  private saveToCache(snapshots: CardBalanceSnapshot[]): void {
    this.storeInLocalStorage(snapshots, Constants.StorageTags.CARD_BALANCE_SNAPSHOTS);
    this.snapshots$.next(snapshots);
  }
}
