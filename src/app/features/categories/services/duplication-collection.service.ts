import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DuplicationCollection } from '../../../core/models/duplication-collection.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class DuplicationCollectionService {
  private readonly _collections$ = new BehaviorSubject<DuplicationCollection[]>([]);
  readonly collections$: Observable<DuplicationCollection[]> = this._collections$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): DuplicationCollection[] { return this._collections$.getValue(); }

  save(col: Partial<DuplicationCollection>): DuplicationCollection {
    return this.storage.save<DuplicationCollection>(STORAGE_KEYS.DUPLICATION_COLLECTIONS, col as DuplicationCollection);
  }

  delete(id: string): void {
    this.storage.delete(STORAGE_KEYS.DUPLICATION_COLLECTIONS, id);
  }

  private refresh(): void {
    this._collections$.next(
      this.storage.getAll<DuplicationCollection>(STORAGE_KEYS.DUPLICATION_COLLECTIONS)
    );
  }
}
