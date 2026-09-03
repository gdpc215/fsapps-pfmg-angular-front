import { BaseEntity } from './base.model';
import { AccountType, TransactionCurrency } from './transaction.model';

export type RecurrenceFrequency = 'MONTHLY' | 'YEARLY';
export type RecurrenceMatchMode = 'MANUAL' | 'AUTOMATIC';
export type RecurrentStatus     = 'DONE' | 'PENDING' | 'NOT_YET_DUE' | 'NOT_CONFIGURED';

export interface RecurrentTransaction extends BaseEntity {
  strName: string;
  strNotes?: string;
  accountId: string;
  accountType: AccountType;
  strFrequency: RecurrenceFrequency;
  strMatchMode: RecurrenceMatchMode;
  strCurrency?: TransactionCurrency;
  decApproxAmount?: number;
  decAmountRange?: number;
  strMatchString?: string;
  intApproxDay?: number;
  intApproxMonth?: number;
  intDayRange?: number;
}
