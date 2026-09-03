import { Injectable } from '@angular/core';
import { CategoryRule } from '../models/category-rule.model';

@Injectable({ providedIn: 'root' })
export class CategoryMatchingService {
  match(description: string, rules: CategoryRule[]): string | undefined {
    const sorted = [...rules].sort((a, b) => a.intPriority - b.intPriority);
    const desc = description.toLowerCase();
    for (const rule of sorted) {
      const pattern = rule.strMatchString.toLowerCase();
      let matched = false;
      switch (rule.strMatchType) {
        case 'STARTS_WITH': matched = desc.startsWith(pattern); break;
        case 'CONTAINS':    matched = desc.includes(pattern);   break;
        case 'ENDS_WITH':   matched = desc.endsWith(pattern);   break;
        case 'EQUALS':      matched = desc === pattern;         break;
      }
      if (matched) return rule.subcategoryId;
    }
    return undefined;
  }
}
