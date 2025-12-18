export class Movement {
  id: string;
  accountOrCardId: string;
  date: Date;
  description: string;
  currency: string;
  amount: number;
  operationNumber: string | null; // Only for account movements
  categoryId: string | null;
  subcategoryId: string | null;
  isStub: boolean; // For auto-generated discrepancy movements

  constructor() {
    this.id = "";
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
