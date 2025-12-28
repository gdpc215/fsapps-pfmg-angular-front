import { Movement } from './movement';

export enum DuplicityStatus {
  NONE = 'NONE',                    // Not a duplicate
  POTENTIAL = 'POTENTIAL',          // Potential duplicate (alert)
  CONFIRMED = 'CONFIRMED'           // Confirmed duplicate
}

export class ImportingMovement extends Movement {
  uuid: string;                     // Unique identifier for this import
  duplicityStatus: DuplicityStatus;
  duplicateOfId: string | null;     // Movement ID this is a duplicate of
  excluded: boolean;                // Whether to exclude from import
  proposedCategoryId: string | null;
  proposedSubcategoryId: string | null;
  categorySource: 'rule' | 'recurrence' | null;

  constructor() {
    super();
    this.uuid = '';
    this.duplicityStatus = DuplicityStatus.NONE;
    this.duplicateOfId = null;
    this.excluded = false;
    this.proposedCategoryId = null;
    this.proposedSubcategoryId = null;
    this.categorySource = null;
  }
}
