export interface SavingsContribution {
  date: string;
  amount: number;
}

export class SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  contributions: SavingsContribution[];

  constructor() {
    this.id = '';
    this.name = '';
    this.targetAmount = 0;
    this.contributions = [];
  }
}
