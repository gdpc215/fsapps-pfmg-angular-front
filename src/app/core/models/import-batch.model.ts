import { BaseEntity } from './base.model';
import { AccountType, TransactionCurrency } from './transaction.model';

export interface ImportBatch extends BaseEntity {
  accountId: string;
  accountType: AccountType;
  dateImport: string;
  decUsdExchangeRate: number;
  decBalanceAtImport: number;
}

export interface RawImportRow {
  dateTransaction: string;
  description: string;
  currency: TransactionCurrency;
  amount: number;
  amountPen: number;
  strOperationNumber?: string;
}

export interface ParseFileResult {
  rows: RawImportRow[];
  hasMultipleSheets: boolean;
  hasUsdRows: boolean;
}
