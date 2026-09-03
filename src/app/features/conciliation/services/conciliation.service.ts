import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CycleClose } from '../../../core/models/cycle-close.model';
import { CycleSnapshot } from '../../../core/models/cycle-snapshot.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class ConciliationService {
  private readonly _cycleCloses$    = new BehaviorSubject<CycleClose[]>([]);
  private readonly _cycleSnapshots$ = new BehaviorSubject<CycleSnapshot[]>([]);

  readonly cycleCloses$:    Observable<CycleClose[]>    = this._cycleCloses$.asObservable();
  readonly cycleSnapshots$: Observable<CycleSnapshot[]> = this._cycleSnapshots$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getCycleCloses(): CycleClose[]       { return this._cycleCloses$.getValue(); }
  getCycleSnapshots(): CycleSnapshot[] { return this._cycleSnapshots$.getValue(); }

  getMostRecentCycleClose(cardId: string): CycleClose | undefined {
    return this.getCycleCloses()
      .filter(cc => cc.cardId === cardId)
      .sort((a, b) => b.dateClosing.localeCompare(a.dateClosing))[0];
  }

  existsCycleClose(cardId: string, dateClosing: string): boolean {
    return this.getCycleCloses().some(
      cc => cc.cardId === cardId && cc.dateClosing === dateClosing
    );
  }

  saveCycleClose(record: Partial<CycleClose>): CycleClose {
    return this.storage.save<CycleClose>(STORAGE_KEYS.CYCLE_CLOSES, record as CycleClose);
  }

  saveCycleSnapshot(record: Partial<CycleSnapshot>): CycleSnapshot {
    return this.storage.save<CycleSnapshot>(STORAGE_KEYS.CYCLE_SNAPSHOTS, record as CycleSnapshot);
  }

  deleteCycleClose(id: string): void    { this.storage.delete(STORAGE_KEYS.CYCLE_CLOSES, id); }
  deleteCycleSnapshot(id: string): void { this.storage.delete(STORAGE_KEYS.CYCLE_SNAPSHOTS, id); }

  private refresh(): void {
    this._cycleCloses$.next(this.storage.getAll<CycleClose>(STORAGE_KEYS.CYCLE_CLOSES));
    this._cycleSnapshots$.next(this.storage.getAll<CycleSnapshot>(STORAGE_KEYS.CYCLE_SNAPSHOTS));
  }
}
