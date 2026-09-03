import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CreditCard } from '../../../core/models/credit-card.model';
import { StorageService } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/services/storage-keys';
import { TransactionService } from '../../transactions/services/transaction.service';
import { ImportBatchService } from '../../import/services/import-batch.service';
import { ConciliationService } from '../../conciliation/services/conciliation.service';
import { RecurrentTransactionService } from '../../recurrent-transactions/services/recurrent-transaction.service';

@Injectable({ providedIn: 'root' })
export class CreditCardService {
  private readonly _cards$ = new BehaviorSubject<CreditCard[]>([]);
  readonly cards$: Observable<CreditCard[]> = this._cards$.asObservable();

  constructor(private storage: StorageService) {
    this.refresh();
    this.storage.changes$.subscribe(() => this.refresh());
  }

  getAll(): CreditCard[] { return this._cards$.getValue(); }
  getById(id: string): CreditCard | undefined { return this.getAll().find(c => c.id === id); }

  save(card: Partial<CreditCard>): CreditCard {
    return this.storage.save<CreditCard>(STORAGE_KEYS.CREDIT_CARDS, card as CreditCard);
  }

  deleteWithCascade(
    id: string,
    deps: {
      transactionService: TransactionService;
      importBatchService: ImportBatchService;
      conciliationService: ConciliationService;
      recurrentService: RecurrentTransactionService;
    }
  ): void {
    deps.transactionService.getAll()
      .filter(t => t.accountId === id)
      .forEach(t => deps.transactionService.softDelete(t.id));

    deps.importBatchService.getAll()
      .filter(b => b.accountId === id)
      .forEach(b => deps.importBatchService.delete(b.id));

    deps.conciliationService.getCycleCloses()
      .filter(cc => cc.cardId === id)
      .forEach(cc => deps.conciliationService.deleteCycleClose(cc.id));
    deps.conciliationService.getCycleSnapshots()
      .filter(s => s.cardId === id)
      .forEach(s => deps.conciliationService.deleteCycleSnapshot(s.id));

    deps.recurrentService.getAll()
      .filter(r => r.accountId === id)
      .forEach(r => deps.recurrentService.deleteWithMatches(r.id));

    this.storage.delete(STORAGE_KEYS.CREDIT_CARDS, id);
  }

  private refresh(): void {
    this._cards$.next(this.storage.getAll<CreditCard>(STORAGE_KEYS.CREDIT_CARDS));
  }
}
