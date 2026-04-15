import { Injectable } from '@angular/core';
import { Constants } from '../constants';
import { Transaction } from '../types/transaction';
import { StorageService } from './storage.service';

export interface DuplicateDetectionRule {
  descriptionGroup: string[];
  accountType: 'debit' | 'credit' | 'all';
  currencies: string[];
}

export interface DuplicateCheckResult {
  status: 'NONE' | 'POTENTIAL' | 'CONFIRMED';
  duplicateOfId: string | null;
}

@Injectable({ providedIn: 'root' })
export class DuplicateDetectionService {
  constructor(private storageService: StorageService) {}

  getRules(): DuplicateDetectionRule[] {
    return this.storageService.get<DuplicateDetectionRule[]>(Constants.StorageTags.DUPLICATE_DETECTION_RULES) || [];
  }

  checkDuplicate(candidate: Transaction, existingTransactions: Transaction[]): DuplicateCheckResult {
    const rules = this.getRules();
    const eligible = existingTransactions.filter((tx) => !tx.isManualOverride);

    if (candidate.operationNumber) {
      const byOperation = eligible.find((tx) => tx.operationNumber && tx.operationNumber === candidate.operationNumber);
      if (byOperation) {
        return { status: 'CONFIRMED', duplicateOfId: byOperation.id };
      }
    }

    const importedDate = new Date(candidate.date);
    const normalizedDesc = this.normalize(candidate.description);
    const isNonPen = candidate.currency !== 'PEN';

    const exactMatch = eligible.find((tx) => {
      if (tx.currency !== candidate.currency || tx.amount !== candidate.amount) {
        return false;
      }

      if (!this.isWithinDateTolerance(new Date(tx.date), importedDate, isNonPen ? 3 : 0)) {
        return false;
      }

      const existingNorm = this.normalize(tx.description);
      if (existingNorm === normalizedDesc) {
        return true;
      }

      return existingNorm.includes(normalizedDesc) || normalizedDesc.includes(existingNorm);
    });

    if (exactMatch) {
      return { status: 'CONFIRMED', duplicateOfId: exactMatch.id };
    }

    const potentialMatch = eligible.find((tx) => {
      const amountMatches = tx.amount === candidate.amount || this.matchesPenNormalized(tx, candidate);
      if (!amountMatches || tx.currency !== candidate.currency) {
        return false;
      }
      return this.isWithinDateTolerance(new Date(tx.date), importedDate, isNonPen ? 3 : 0);
    });

    if (potentialMatch) {
      return { status: 'POTENTIAL', duplicateOfId: potentialMatch.id };
    }

    const candidateGroups = rules.filter((rule) => {
      const supportsCurrency = rule.currencies.includes('all') || rule.currencies.includes(candidate.currency);
      if (!supportsCurrency) {
        return false;
      }
      const normalized = rule.descriptionGroup.map((item) => this.normalize(item));
      return normalized.includes(normalizedDesc);
    });

    if (!candidateGroups.length) {
      return { status: 'NONE', duplicateOfId: null };
    }

    const ruleMatch = eligible.find((tx) => {
      if (tx.currency !== candidate.currency) {
        return false;
      }

      const amountMatches = tx.amount === candidate.amount || this.matchesPenNormalized(tx, candidate);
      if (!amountMatches) {
        return false;
      }

      if (!this.isWithinDateTolerance(new Date(tx.date), importedDate, isNonPen ? 3 : 0)) {
        return false;
      }

      const existingNorm = this.normalize(tx.description);
      return candidateGroups.some((group) => {
        const normalized = group.descriptionGroup.map((item) => this.normalize(item));
        return normalized.includes(existingNorm) || normalized.some((item) => existingNorm.includes(item) || item.includes(existingNorm));
      });
    });

    if (ruleMatch) {
      return { status: 'CONFIRMED', duplicateOfId: ruleMatch.id };
    }

    return { status: 'NONE', duplicateOfId: null };
  }

  private normalize(value: string): string {
    return (value || '').replace(/\s+/g, '').toLowerCase();
  }

  private isWithinDateTolerance(a: Date, b: Date, toleranceDays: number): boolean {
    const deltaDays = Math.abs(Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
    return deltaDays <= toleranceDays;
  }

  private matchesPenNormalized(existing: Transaction, candidate: Transaction): boolean {
    if (typeof existing.amountPen !== 'number' || typeof candidate.amountPen !== 'number') {
      return false;
    }
    return Math.abs(existing.amountPen - candidate.amountPen) < 0.01;
  }
}
