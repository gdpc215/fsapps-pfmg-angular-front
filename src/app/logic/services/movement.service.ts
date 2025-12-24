import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Movement, MovementType } from '../types/movement';
import { Utilities } from '../utilities';
import { AccountService } from './account.service';
import { BaseService } from './base.service';

// Duplicate detection rule type
export interface DuplicateDetectionRule {
  descriptionGroup: string[]; // All descriptions in this group are considered equivalent
  accountType: 'debit' | 'credit' | 'all';
  currencies: string[]; // e.g., ['PEN', 'USD'] or ['all']
}

@Injectable({ providedIn: 'root' })
export class MovementService extends BaseService {

  private movements$ = new BehaviorSubject<Movement[]>([]);

  // Fetch duplicate detection rules from settings/local storage
  private getDuplicateDetectionRules(): DuplicateDetectionRule[] {
    // TODO: Replace with actual settings retrieval
    // Example stub: return from local storage or settings service
    const rules = this.fetchFromLocalStorage<DuplicateDetectionRule[]>(Constants.StorageTags.DUPLICATE_DETECTION_RULES);
    return rules || [];
  }

  constructor(private accountService: AccountService) {
    super('MovementService');
    this.loadFromCache();
  }

  getMovements(): Observable<Movement[]> {
    return this.movements$.asObservable();
  }

  getMovementsByAccountOrCard(accountOrCardId: string): Movement[] {
    return this.movements$.value.filter(m => m.accountOrCardId === accountOrCardId);
  }

  addMovement(movement: Movement): void {
    movement.id = Utilities.generateUUID();
    const movements = [...this.movements$.value, movement];
    this.saveToCache(movements);
    this.updateAccountBalances(movement, 'add');
  }

  addMovements(movements: Movement[]): void {
    const newMovements = movements.map(m => ({ ...m, id: Utilities.generateUUID() }));
    const allMovements = [...this.movements$.value, ...newMovements];
    this.saveToCache(allMovements);

    // Calculate total balance changes per account
    const balanceChanges = new Map<string, number>();

    newMovements.forEach(m => {
      // Accumulate balance change for source account
      const currentChange = balanceChanges.get(m.accountOrCardId) || 0;
      balanceChanges.set(m.accountOrCardId, currentChange + m.amount);

      // For transfers, also accumulate for target account
      if (m.type === MovementType.TRANSFER && m.targetAccountOrCardId) {
        const targetChange = balanceChanges.get(m.targetAccountOrCardId) || 0;
        balanceChanges.set(m.targetAccountOrCardId, targetChange + Math.abs(m.amount));
      }
    });

    // Apply all balance changes in one batch
    balanceChanges.forEach((amount, accountId) => {
      this.accountService.updateBalance(accountId, amount);
    });
  }

  updateMovement(movement: Movement): void {
    // Find the old movement to calculate balance difference
    const oldMovement = this.movements$.value.find(m => m.id === movement.id);

    const movements = this.movements$.value.map(m =>
      m.id === movement.id ? movement : m
    );
    this.saveToCache(movements);

    // Reverse old movement and apply new one
    if (oldMovement) {
      this.updateAccountBalances(oldMovement, 'remove');
      this.updateAccountBalances(movement, 'add');
    }
  }

  deleteMovement(id: string): void {
    const movement = this.movements$.value.find(m => m.id === id);
    const movements = this.movements$.value.filter(m => m.id !== id);
    this.saveToCache(movements);

    // Reverse the movement's balance effect
    if (movement) {
      this.updateAccountBalances(movement, 'remove');
    }
  }

  categorizeMovement(id: string, categoryId: string | null, subcategoryId: string | null): void {
    const movements = this.movements$.value.map(m =>
      m.id === id ? { ...m, categoryId, subcategoryId } : m
    );
    this.saveToCache(movements);
  }

  deleteAll(): void {
    this.saveToCache([]);
  }


  // Helper to get account type for a movement
  getAccountType = (m: Movement): 'debit' | 'credit' => {
    // You may need to adjust this logic based on your account/card model
    // For now, assume operationNumber presence means debit, otherwise credit
    return m.operationNumber ? 'debit' : 'credit';
  };

  // Helper to normalize descriptions (remove spaces and lowercase)
  normalize = (s: string) => (s || '').replace(/\s/g, '').toLowerCase();

  /**
   * Check if a movement is a duplicate of an existing movement
   * Returns true if the movement already exists in the system
   * 
   * For debit accounts (with operation numbers): Matches by operation number + account ID
   * For credit accounts (without operation numbers): Smart matching that:
   *   - Matches same currency and amount
   *   - Allows ±3 days tolerance for non-PEN currencies (handles approval vs processing date differences)
   *   - Handles description expansion (e.g., "UBER EATS" → "UBER EATS *3122")
   */
  isDuplicate(movement: Movement, hasOperationNumber: boolean): boolean {
    const existing = this.movements$.value;
    const rules = this.getDuplicateDetectionRules();

    if (hasOperationNumber && movement.operationNumber) {
      // Account movement - check by operation number
      return existing.some(e =>
        e.operationNumber === movement.operationNumber &&
        e.accountOrCardId === movement.accountOrCardId
      );
    } else {
      // Credit card movement - use smart comparison
      const importedDate = new Date(movement.date);
      const isNonPEN = movement.currency !== 'PEN';
      const accountType = this.getAccountType(movement);
      const importedDescNorm = this.normalize(movement.description);

      // First, run the normal/fast matching flow (no rules): equality/contains checks
      const found = existing.some(e => {
        // Only compare movements from the same account
        if (e.accountOrCardId !== movement.accountOrCardId) return false;

        // Must have same currency and amount
        if (e.currency !== movement.currency || e.amount !== movement.amount) return false;

        const existingDate = new Date(e.date);

        // Check date match
        let dateMatches = existingDate.toDateString() === importedDate.toDateString();

        // For non-PEN currencies, also check within ±3 days
        if (!dateMatches && isNonPEN) {
          const daysDiff = Math.abs(Math.floor((importedDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)));
          dateMatches = daysDiff <= 3;
        }
        if (!dateMatches) return false;

        // Check for description equivalence using rules that apply to the imported movement
        const existingDescNorm = this.normalize(e.description);

        // Fast path: direct equality or containment checks (handles most cases)
        if (existingDescNorm === importedDescNorm) return true;
        if (existingDescNorm.includes(importedDescNorm) || importedDescNorm.includes(existingDescNorm)) return true;

        return false;
      });

      if (found) return true;

      // Last resort: apply duplicate-detection rules ONLY if the imported description appears in any rule group
      const importedDescNormForRules = importedDescNorm;
      const matchedRules = rules.filter(rule => {
        if (rule.accountType !== 'all' && rule.accountType !== accountType) return false;
        if (rule.currencies.indexOf('all') === -1 && !rule.currencies.includes(movement.currency)) return false;
        const normalizedGroup = rule.descriptionGroup.map(d => this.normalize(d));
        return normalizedGroup.includes(importedDescNormForRules);
      });

      if (matchedRules.length === 0) return false;

      // Check existing movements against matched rule groups
      return existing.some(e => {
        if (e.accountOrCardId !== movement.accountOrCardId) return false;
        if (e.currency !== movement.currency || e.amount !== movement.amount) return false;

        const existingDate = new Date(e.date);
        let dateMatches = existingDate.toDateString() === importedDate.toDateString();
        if (!dateMatches && isNonPEN) {
          const daysDiff = Math.abs(Math.floor((importedDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)));
          dateMatches = daysDiff <= 3;
        }
        if (!dateMatches) return false;

        const existingDescNorm = this.normalize(e.description);

        // For each matched rule, check group membership/containment
        for (const rule of matchedRules) {
          const normalizedGroup = rule.descriptionGroup.map(d => this.normalize(d));
          if (normalizedGroup.includes(existingDescNorm)) return true;
          if (normalizedGroup.some(g => existingDescNorm.includes(g) || g.includes(existingDescNorm))) return true;
        }

        return false;
      });
    }
  }

  /**
   * Update account balances based on movement type
   * @param movement The movement affecting the balance
   * @param operation 'add' when adding/importing a movement, 'remove' when deleting or before updating
   */
  private updateAccountBalances(movement: Movement, operation: 'add' | 'remove'): void {
    const multiplier = operation === 'add' ? 1 : -1;

    // Movement amounts are already signed (expenses are negative, income is positive)
    // Just apply the amount directly with the multiplier
    this.accountService.updateBalance(movement.accountOrCardId, movement.amount * multiplier);

    // For transfers, also update the target account
    if (movement.type === MovementType.TRANSFER && movement.targetAccountOrCardId) {
      // Source account already decreased above, now increase target account
      // Use absolute value since we want to add the same amount to target
      this.accountService.updateBalance(movement.targetAccountOrCardId, Math.abs(movement.amount) * multiplier);
    }
  }

  private loadFromCache(): void {
    const cached = this.fetchFromLocalStorage<Movement[]>(Constants.StorageTags.MOVEMENTS);
    // Parse dates from string format
    const movements = (cached || []).map(m => ({
      ...m,
      date: new Date(m.date)
    }));
    this.movements$.next(movements);
  }

  private saveToCache(movements: Movement[]): void {
    this.storeInLocalStorage(movements, Constants.StorageTags.MOVEMENTS);
    this.movements$.next(movements);
  }
}
