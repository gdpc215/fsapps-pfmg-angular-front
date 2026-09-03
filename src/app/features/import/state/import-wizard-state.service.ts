import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AccountType } from '../../../core/models/transaction.model';
import { AnnotatedImportRow } from '../../../core/services/duplication-logic.service';

export interface ImportWizardState {
  accountId: string | null;
  accountType: AccountType | null;
  currentBalance: number | null;
  usdExchangeRate: number | null;
  annotatedRows: AnnotatedImportRow[];
  contextTransactionIds: string[];
  pendingDeletions: string[];
}

const INITIAL_STATE: ImportWizardState = {
  accountId: null,
  accountType: null,
  currentBalance: null,
  usdExchangeRate: null,
  annotatedRows: [],
  contextTransactionIds: [],
  pendingDeletions: [],
};

@Injectable({ providedIn: 'root' })
export class ImportWizardStateService {
  private readonly _state$ = new BehaviorSubject<ImportWizardState>({ ...INITIAL_STATE });
  readonly state$ = this._state$.asObservable();

  getState(): ImportWizardState { return this._state$.getValue(); }

  patch(partial: Partial<ImportWizardState>): void {
    this._state$.next({ ...this.getState(), ...partial });
  }

  reset(): void {
    this._state$.next({ ...INITIAL_STATE });
  }
}
