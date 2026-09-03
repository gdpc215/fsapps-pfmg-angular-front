import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ImportBatch } from '../../../core/models/import-batch.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class ImportBatchService {
  private readonly _batches$ = new BehaviorSubject<ImportBatch[]>([]);
  readonly batches$: Observable<ImportBatch[]> = this._batches$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): ImportBatch[] { return this._batches$.getValue(); }

  getLatestForAccount(accountId: string): ImportBatch | undefined {
    return this.getAll()
      .filter(b => b.accountId === accountId)
      .sort((a, b) => b.dateImport.localeCompare(a.dateImport))[0];
  }

  save(batch: Partial<ImportBatch>): ImportBatch {
    return this.storage.save<ImportBatch>(STORAGE_KEYS.IMPORT_BATCHES, batch as ImportBatch);
  }

  delete(id: string): void {
    this.storage.delete(STORAGE_KEYS.IMPORT_BATCHES, id);
  }

  private refresh(): void {
    this._batches$.next(this.storage.getAll<ImportBatch>(STORAGE_KEYS.IMPORT_BATCHES));
  }
}
