export type SourceCurrency = 'PEN' | 'USD';

export enum FinancialSourceType {
  ACCOUNT = 'ACCOUNT',
  CREDIT_CARD = 'CREDIT_CARD'
}

export class FinancialSource {
  id: string;
  name: string;
  type: FinancialSourceType;
  currency?: SourceCurrency;
  closingDay?: number;
  dueDay?: number;
  creditLinePen?: number;
  color?: string;

  constructor() {
    this.id = '';
    this.name = '';
    this.type = FinancialSourceType.ACCOUNT;
    this.currency = 'PEN';
    this.color = '#ba68c8';
  }
}
