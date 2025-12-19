export enum AccountType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT'
}

export class Account {
  id: string;
  name: string;
  type: AccountType;
  currencyId: string;
  currentBalance: number;
  lastCheckpointBalance: number;
  lastCheckpointDate: Date | null;
  
  // Credit card specific fields
  paymentCurrencyId?: string;  // For credit cards with different payment currency
  paymentDate?: number;         // Day of month for payment (1-31)
  billingDate?: number;         // Day of month for billing/interest calculation (1-31)
  creditLimit?: number;

  constructor() {
    this.id = "";
    this.name = "";
    this.type = AccountType.DEBIT;
    this.currencyId = "";
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
