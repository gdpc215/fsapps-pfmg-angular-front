import { BaseEntity } from './base.model';

export type TransactionCurrency = 'PEN' | 'USD';
export type TransactionStatus   = 'ACTIVE' | 'DELETED' | 'PENDING';
export type AccountType         = 'CREDIT_CARD' | 'DEBIT_ACCOUNT';

export interface Transaction extends BaseEntity {
  accountId: string;
  accountType: AccountType;
  importBatchId?: string;
  dateTransaction: string;
  strDescription: string;
  strCurrency: TransactionCurrency;
  decAmount: number;
  decAmountPen: number;
  subcategoryId?: string;
  strNotes?: string;
  strStatus: TransactionStatus;
  strOperationNumber?: string;
  transferGroupId?: string;
}
