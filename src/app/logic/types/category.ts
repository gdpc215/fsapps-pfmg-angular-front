export class Category {
  id: string;
  name: string;
  parentId: string | null; // null for top-level categories

  constructor() {
    this.id = "";
    this.name = "";
    this.parentId = null;
  }
}

export type RuleType = 'exact' | 'startsWith' | 'contains';

export class CategoryRule {
  id: string;
  categoryId: string;
  ruleType: RuleType;
  pattern: string;

  constructor() {
    this.id = "";
    this.categoryId = "";
    this.ruleType = 'contains';
    this.pattern = "";
  }
}
