import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DebitAccount } from '../../../core/models/debit-account.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { TransactionService } from '../../transactions/services/transaction.service';
import { ImportBatchService } from '../../import/services/import-batch.service';
import { RecurrentTransactionService } from '../../recurrent-transactions/services/recurrent-transaction.service';

@Injectable({ providedIn: 'root' })
export class DebitAccountService {
  private readonly _accounts$ = new BehaviorSubject<DebitAccount[]>([]);
  readonly accounts$: Observable<DebitAccount[]> = this._accounts$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): DebitAccount[] { return this._accounts$.getValue(); }
  getById(id: string): DebitAccount | undefined { return this.getAll().find(a => a.id === id); }

  save(account: Partial<DebitAccount>): DebitAccount {
    return this.storage.save<DebitAccount>(STORAGE_KEYS.DEBIT_ACCOUNTS, account as DebitAccount);
  }

  deleteWithCascade(
    id: string,
    deps: {
      transactionService: TransactionService;
      importBatchService: ImportBatchService;
      recurrentService: RecurrentTransactionService;
    }
  ): void {
    deps.transactionService.getAll()
      .filter(t => t.accountId === id)
      .forEach(t => deps.transactionService.softDelete(t.id));

    deps.importBatchService.getAll()
      .filter(b => b.accountId === id)
      .forEach(b => deps.importBatchService.delete(b.id));

    deps.recurrentService.getAll()
      .filter(r => r.accountId === id)
      .forEach(r => deps.recurrentService.deleteWithMatches(r.id));

    this.storage.delete(STORAGE_KEYS.DEBIT_ACCOUNTS, id);
  }

  private refresh(): void {
    this._accounts$.next(this.storage.getAll<DebitAccount>(STORAGE_KEYS.DEBIT_ACCOUNTS));
  }
}
