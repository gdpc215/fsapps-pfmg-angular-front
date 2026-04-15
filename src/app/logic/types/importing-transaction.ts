import { Transaction } from './transaction';

export enum DuplicityStatus {
  NONE = 'NONE',
  POTENTIAL = 'POTENTIAL',
  CONFIRMED = 'CONFIRMED'
}

export class ImportingTransaction extends Transaction {
  uuid: string;
  duplicityStatus: DuplicityStatus;
  duplicateOfId: string | null;
  excluded: boolean;
  proposedCategoryId: string | null;
  proposedSubcategoryId: string | null;
  categorySource: 'rule' | 'recurrence' | null;
  recurringConflict: boolean;
  recurringCandidates: string[];

  constructor() {
    super();
    this.uuid = '';
    this.duplicityStatus = DuplicityStatus.NONE;
    this.duplicateOfId = null;
    this.excluded = false;
    this.proposedCategoryId = null;
    this.proposedSubcategoryId = null;
    this.categorySource = null;
    this.recurringConflict = false;
    this.recurringCandidates = [];
  }
}
