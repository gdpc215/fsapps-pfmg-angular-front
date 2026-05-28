import { BaseEntity } from './base.model';

export type MatchType = 'STARTS_WITH' | 'CONTAINS' | 'ENDS_WITH' | 'EQUALS';

export interface CategoryRule extends BaseEntity {
  subcategoryId: string;
  strMatchString: string;
  strMatchType: MatchType;
  intPriority: number;
}
