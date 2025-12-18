export class Account {
  id: string;
  name: string;
  currencyId: string;
  currentBalance: number;
  lastCheckpointBalance: number;
  lastCheckpointDate: Date | null;

  constructor() {
    this.id = "";
    this.name = "";
    this.currencyId = "";
    this.currentBalance = 0;
    this.lastCheckpointBalance = 0;
    this.lastCheckpointDate = null;
  }
}
