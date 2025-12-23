import { MovementType } from './movement';

export enum RecurrenceType {
  DAY_OF_MONTH = 'DAY_OF_MONTH',  // e.g., 2nd of each month
  DAY_OF_YEAR = 'DAY_OF_YEAR'     // e.g., January 15th every year
}

export enum ExecutionMode {
  AUTOMATIC = 'AUTOMATIC',  // Automatically tagged when imported
  MANUAL = 'MANUAL'         // Must be manually executed
}

export class RecurrentTransaction {
  id: string;
  name: string;                   // Name/description of this recurrent transaction
  active: boolean;                // Whether this recurrence is enabled
  executionMode: ExecutionMode;   // Automatic or Manual execution
  
  // Movement details (same as Movement)
  type: MovementType;
  accountOrCardId: string;
  payee: string;
  description: string;
  notes: string;
  currency: string;
  amount: number;
  categoryId: string | null;
  subcategoryId: string | null;
  labels: string[];
  
  // Transfer specific fields
  targetAccountOrCardId?: string; // Destination account for transfers
  
  // Recurrence pattern
  recurrenceType: RecurrenceType;
  dayOfMonth?: number;            // 1-31 for DAY_OF_MONTH
  month?: number;                 // 1-12 for DAY_OF_YEAR
  dayOfYear?: number;             // 1-31 for DAY_OF_YEAR (combined with month)
  
  // Tracking
  lastExecuted: Date | null;      // Last time this recurrence was executed
  nextExecution: Date | null;     // Next scheduled execution date
  skippedUntil: Date | null;      // If set, skip execution until this date
  
  // Manual execution fields
  maxDaysToExecute?: number;      // For manual: max days after nextExecution to execute

  constructor() {
    this.id = "";
    this.name = "";
    this.active = true;
    this.executionMode = ExecutionMode.MANUAL;
    this.type = MovementType.EXPENSE;
    this.accountOrCardId = "";
    this.payee = "";
    this.description = "";
    this.notes = "";
    this.currency = "";
    this.amount = 0;
    this.categoryId = null;
    this.subcategoryId = null;
    this.labels = [];
    this.recurrenceType = RecurrenceType.DAY_OF_MONTH;
    this.lastExecuted = null;
    this.nextExecution = null;
    this.skippedUntil = null;
    this.maxDaysToExecute = 30;
  }
}
