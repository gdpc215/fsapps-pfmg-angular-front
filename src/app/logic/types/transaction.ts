export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
  PAYMENT = 'PAYMENT',
  INTEREST = 'INTEREST'
}

export class Transaction {
  id: string;
  sourceId: string;
  date: string | Date;
  amount: number;
  currency: 'PEN' | 'USD' | string;
  amountPen?: number;
  exchangeRate?: number;
  description: string;
  normalizedDescription: string;
  userDescription?: string;
  category?: string;
  subcategory?: string;
  type: TransactionType;
  operationNumber?: string | null;
  isManualOverride: boolean;
  recurringMatchId?: string;
  linkedTransactionId?: string;

  // Legacy compatibility fields used by existing UI components.
  payee?: string;
  notes?: string;
  labels?: string[];
  additionalInfo?: string;
  targetAccountOrCardId?: string;
  isStub?: boolean;

  constructor() {
    this.id = '';
    this.sourceId = '';
    this.date = new Date().toISOString().slice(0, 10);
    this.amount = 0;
    this.currency = 'PEN';
    this.description = '';
    this.normalizedDescription = '';
    this.type = TransactionType.EXPENSE;
    this.isManualOverride = false;
    this.labels = [];
    this.payee = '';
    this.notes = '';
    this.additionalInfo = '';
  }

  get accountOrCardId(): string {
    return this.sourceId;
  }

  set accountOrCardId(value: string) {
    this.sourceId = value;
  }

  get bankDescription(): string {
    return this.description;
  }

  set bankDescription(value: string) {
    this.description = value;
    this.normalizedDescription = (value || '').replace(/\s+/g, '').toLowerCase();
  }

  get categoryId(): string | null {
    return this.category || null;
  }

  set categoryId(value: string | null) {
    this.category = value || undefined;
  }

  get subcategoryId(): string | null {
    return this.subcategory || null;
  }

  set subcategoryId(value: string | null) {
    this.subcategory = value || undefined;
  }
}
