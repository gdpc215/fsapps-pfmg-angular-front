import { BaseEntity } from './base.model';

export interface CreditCard extends BaseEntity {
  strName: string;
  intClosingDay: number;
  intPaymentDay: number;
}
