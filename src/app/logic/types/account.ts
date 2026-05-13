
export enum AccountType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

export class Account {
  id: string;
  name: string;
  type: AccountType;
  color: string;
  currencyId: string;
  initialBalance: number;
  currentBalance: number;
  lastCheckpointBalance: number;
  lastCheckpointDate: Date | null;
  paymentCurrencyId?: string;
  paymentDate?: number;
  billingDate?: number;
  creditLimit?: number;

  constructor() {
    this.id = '';
    this.name = '';
    this.type = AccountType.DEBIT;
    this.color = '#ba68c8';
    this.currencyId = '';
    this.initialBalance = 0;
    this.currentBalance = 0;
    this.lastCheckpointBalance = 0;
    this.lastCheckpointDate = null;
  }

  get isCredit(): boolean {
    return this.type === AccountType.CREDIT;
  }

  get isDebit(): boolean {
    return this.type === AccountType.DEBIT;
  }
}
