import { BaseEntity } from './base.model';

export interface DuplicationCollection extends BaseEntity {
  strName: string;
  strings: string[];
}
