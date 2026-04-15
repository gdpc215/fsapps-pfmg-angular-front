export type RecurringFrequency = 'MONTHLY' | 'WEEKLY' | 'CUSTOM';

export class RecurringRule {
  id: string;
  name: string;
  matchString: string;
  expectedAmount: number;
  tolerance: number;
  frequency: RecurringFrequency;
  dayOfMonth?: number;
  dayOfWeek?: number;
  sourceId: string;
  lastMatchedDate?: string;

  constructor() {
    this.id = '';
    this.name = '';
    this.matchString = '';
    this.expectedAmount = 0;
    this.tolerance = 0.1;
    this.frequency = 'MONTHLY';
    this.sourceId = '';
  }
}
