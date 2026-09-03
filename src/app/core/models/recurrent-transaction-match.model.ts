import { BaseEntity } from './base.model';
import { RecurrenceMatchMode } from './recurrent-transaction.model';

export interface RecurrentTransactionMatch extends BaseEntity {
  recurrentTransactionId: string;
  strIterationKey: string;
  transactionId?: string;
  boolDone: boolean;
  dateDone?: string;
  strMatchMode: RecurrenceMatchMode;
}
