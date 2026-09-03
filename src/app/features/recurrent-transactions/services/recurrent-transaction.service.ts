import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RecurrentTransaction } from '../../../core/models/recurrent-transaction.model';
import { RecurrentTransactionMatch } from '../../../core/models/recurrent-transaction-match.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';

@Injectable({ providedIn: 'root' })
export class RecurrentTransactionService {
  private readonly _recurrents$ = new BehaviorSubject<RecurrentTransaction[]>([]);
  private readonly _matches$    = new BehaviorSubject<RecurrentTransactionMatch[]>([]);

  readonly recurrents$: Observable<RecurrentTransaction[]>       = this._recurrents$.asObservable();
  readonly matches$:    Observable<RecurrentTransactionMatch[]>  = this._matches$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): RecurrentTransaction[]            { return this._recurrents$.getValue(); }
  getAllMatches(): RecurrentTransactionMatch[] { return this._matches$.getValue(); }

  getMatchForIteration(
    recurrentId: string,
    iterationKey: string
  ): RecurrentTransactionMatch | undefined {
    return this.getAllMatches().find(
      m => m.recurrentTransactionId === recurrentId && m.strIterationKey === iterationKey
    );
  }

  save(r: Partial<RecurrentTransaction>): RecurrentTransaction {
    return this.storage.save<RecurrentTransaction>(STORAGE_KEYS.RECURRENT_TRANSACTIONS, r as RecurrentTransaction);
  }

  saveMatch(match: Partial<RecurrentTransactionMatch>): RecurrentTransactionMatch {
    return this.storage.save<RecurrentTransactionMatch>(STORAGE_KEYS.RECURRENT_MATCHES, match as RecurrentTransactionMatch);
  }

  deleteMatch(id: string): void {
    this.storage.delete(STORAGE_KEYS.RECURRENT_MATCHES, id);
  }

  deleteWithMatches(id: string): void {
    this.getAllMatches()
      .filter(m => m.recurrentTransactionId === id)
      .forEach(m => this.deleteMatch(m.id));
    this.storage.delete(STORAGE_KEYS.RECURRENT_TRANSACTIONS, id);
  }

  private refresh(): void {
    this._recurrents$.next(
      this.storage.getAll<RecurrentTransaction>(STORAGE_KEYS.RECURRENT_TRANSACTIONS)
    );
    this._matches$.next(
      this.storage.getAll<RecurrentTransactionMatch>(STORAGE_KEYS.RECURRENT_MATCHES)
    );
  }
}
