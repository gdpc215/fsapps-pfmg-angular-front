import { ImportingTransaction } from './importing-transaction';
import { Transaction } from './transaction';

export type ImportDateGroup = {
  dateKey: string;
  date: Date;
  incoming: ImportingTransaction[];
  existing: Transaction[];
};
