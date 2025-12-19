export enum MovementType {
  EXPENSE = 'EXPENSE',   // Negative amount
  INCOME = 'INCOME',     // Positive amount
  TRANSFER = 'TRANSFER'  // Movement between accounts
}

export class Movement {
  id: string;
  type: MovementType;
  accountOrCardId: string;
  date: Date;
  description: string;
  currency: string;
  amount: number;
  operationNumber: string | null; // Only for account movements
  categoryId: string | null;
  subcategoryId: string | null;
  isStub: boolean; // For auto-generated discrepancy movements
  
  // Transfer specific fields
  linkedMovementId?: string;      // ID of the paired movement in transfer
  targetAccountOrCardId?: string; // Destination account for transfers

  constructor() {
    this.id = "";
    this.type = MovementType.EXPENSE;
    this.accountOrCardId = "";
    this.date = new Date();
    this.description = "";
    this.currency = "";
    this.amount = 0;
    this.operationNumber = null;
    this.categoryId = null;
    this.subcategoryId = null;
    this.isStub = false;
  }
}
