export class CardBalanceSnapshot {
  id: string;
  accountId: string;
  snapshotDate: Date;
  owedAmount: number;
  delta: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;

  constructor() {
    this.id = '';
    this.accountId = '';
    this.snapshotDate = new Date();
    this.owedAmount = 0;
    this.delta = 0;
    this.notes = '';
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}
