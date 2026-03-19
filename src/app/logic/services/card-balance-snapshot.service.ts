import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { CardBalanceSnapshot } from '../types/card-balance-snapshot';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class CardBalanceSnapshotService extends BaseService {

  private snapshots$ = new BehaviorSubject<CardBalanceSnapshot[]>([]);

  constructor() {
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

  getLatestSnapshotBeforeOrOn(accountId: string, date: Date): CardBalanceSnapshot | null {
    const targetTime = new Date(date).getTime();
    const matches = this.snapshots$.value
      .filter(s => s.accountId === accountId && new Date(s.snapshotDate).getTime() <= targetTime)
      .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());

    return matches.length > 0 ? matches[0] : null;
  }

  addSnapshot(snapshot: CardBalanceSnapshot): void {
    const now = new Date();
    snapshot.id = Utilities.generateUUID();
    snapshot.createdAt = now;
    snapshot.updatedAt = now;

    const snapshots = [...this.snapshots$.value, snapshot];
    this.saveToCache(snapshots);
  }

  updateSnapshot(snapshot: CardBalanceSnapshot): void {
    const snapshots = this.snapshots$.value.map(s =>
      s.id === snapshot.id
        ? {
            ...snapshot,
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
