export class Card {
  id: string;
  name: string;
  primaryCurrencyId: string;
  secondaryCurrencyId: string | null;
  currentBalance: number;
  lastCheckpointBalance: number;
  lastCheckpointDate: Date | null;
  interestDate: number; // Day of month (1-31)
  paymentDate: number; // Day of month (1-31)

  constructor() {
    this.id = "";
    this.name = "";
    this.primaryCurrencyId = "";
    this.secondaryCurrencyId = null;
    this.currentBalance = 0;
    this.lastCheckpointBalance = 0;
    this.lastCheckpointDate = null;
    this.interestDate = 1;
    this.paymentDate = 1;
  }
}
