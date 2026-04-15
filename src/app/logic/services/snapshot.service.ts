import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { BalanceSnapshot } from '../types/balance-snapshot';
import { Utilities } from '../utilities';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class SnapshotService {
  private snapshots$ = new BehaviorSubject<BalanceSnapshot[]>([]);

  constructor(private storageService: StorageService) {
    this.load();
  }

  getSnapshots(): Observable<BalanceSnapshot[]> {
    return this.snapshots$.asObservable();
  }

  getBySource(sourceId: string): BalanceSnapshot[] {
    return this.snapshots$.value
      .filter((s) => s.sourceId === sourceId)
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }

  addSnapshot(snapshot: BalanceSnapshot): void {
    snapshot.id = Utilities.generateUUID();
    this.save([...this.snapshots$.value, snapshot]);
  }

  updateSnapshot(snapshot: BalanceSnapshot): void {
    this.save(this.snapshots$.value.map((s) => s.id === snapshot.id ? snapshot : s));
  }

  deleteSnapshot(id: string): void {
    this.save(this.snapshots$.value.filter((s) => s.id !== id));
  }

  getLastBefore(sourceId: string, targetDate: string): BalanceSnapshot | null {
    const target = new Date(targetDate).getTime();
    const matches = this.getBySource(sourceId).filter((s) => new Date(s.datetime).getTime() < target);
    return matches.length ? matches[matches.length - 1] : null;
  }

  getFirstAfter(sourceId: string, targetDate: string): BalanceSnapshot | null {
    const target = new Date(targetDate).getTime();
    const matches = this.getBySource(sourceId).filter((s) => new Date(s.datetime).getTime() > target);
    return matches.length ? matches[0] : null;
  }

  private load(): void {
    const cached = this.storageService.get<BalanceSnapshot[]>(Constants.StorageTags.BALANCE_SNAPSHOTS) || [];
    this.snapshots$.next(cached);
  }

  private save(snapshots: BalanceSnapshot[]): void {
    this.storageService.set(Constants.StorageTags.BALANCE_SNAPSHOTS, snapshots);
    this.snapshots$.next(snapshots);
  }
}
