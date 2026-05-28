import { BaseEntity } from './base.model';

export interface CycleClose extends BaseEntity {
  cardId: string;
  dateClosing: string;
  decOpeningBalance: number;
  decClosingBalance: number;
  decInterestAmount: number;
  interestTransactionId?: string;
}
