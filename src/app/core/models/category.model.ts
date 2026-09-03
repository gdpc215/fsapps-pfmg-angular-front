import { BaseEntity } from './base.model';

export interface Category extends BaseEntity {
  strName: string;
}

export interface Subcategory extends BaseEntity {
  categoryId: string;
  strName: string;
}
