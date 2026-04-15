import { SourceCurrency } from './financial-source';

export class BalanceSnapshot {
  id: string;
  sourceId: string;
  datetime: string;
  balance: number;
  currency: SourceCurrency;

  constructor() {
    this.id = '';
    this.sourceId = '';
    this.datetime = new Date().toISOString();
    this.balance = 0;
    this.currency = 'PEN';
  }
}
