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

// Account-based movements structure
export interface AccountMovements {
  accountId: string;
  movements: Movement[];
}

export interface MovementsByAccount {
  [accountId: string]: Movement[];
}

@Injectable({ providedIn: 'root' })
export class MovementService extends BaseService {

  private movementsByAccount$ = new BehaviorSubject<MovementsByAccount>({});

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

  getMovementsByAccountOrCard(accountOrCardId: string): Movement[] {
    return this.movementsByAccount$.value[accountOrCardId] || [];
  }

  getMovementsByAccountMap(): Observable<MovementsByAccount> {
    return this.movementsByAccount$.asObservable();
  }

  addMovement(movement: Movement): void {
    movement.id = Utilities.generateUUID();
    const byAccount = { ...this.movementsByAccount$.value };
    const accountId = movement.accountOrCardId;
    
    if (!byAccount[accountId]) {
      byAccount[accountId] = [];
    }
    
    byAccount[accountId] = [...byAccount[accountId], movement];
    this.saveToCache(byAccount);
    this.updateAccountBalances(movement, 'add');
  }

  addMovements(movements: Movement[]): void {
    const newMovements = movements.map(m => ({ ...m, id: Utilities.generateUUID() }));
    const byAccount = { ...this.movementsByAccount$.value };
    
    // Group new movements by account and add them
    newMovements.forEach(movement => {
      const accountId = movement.accountOrCardId;
      if (!byAccount[accountId]) {
        byAccount[accountId] = [];
      }
      byAccount[accountId] = [...byAccount[accountId], movement];
    });
    
    this.saveToCache(byAccount);

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
    const byAccount = { ...this.movementsByAccount$.value };
    const accountId = movement.accountOrCardId;
    
    // Find the old movement to calculate balance difference
    let oldMovement: Movement | undefined;
    
    // Search in all accounts for the old movement
    for (const accId in byAccount) {
      const found = byAccount[accId].find(m => m.id === movement.id);
      if (found) {
        oldMovement = found;
        // Remove from old account if account changed
        if (accId !== accountId) {
          byAccount[accId] = byAccount[accId].filter(m => m.id !== movement.id);
        }
        break;
      }
    }
    
    // Update or add to target account
    if (!byAccount[accountId]) {
      byAccount[accountId] = [];
    }
    
    byAccount[accountId] = byAccount[accountId].map(m =>
      m.id === movement.id ? movement : m
    );
    
    // If movement wasn't in this account before, add it
    if (oldMovement && oldMovement.accountOrCardId !== accountId) {
      byAccount[accountId] = [...byAccount[accountId], movement];
    }
    
    this.saveToCache(byAccount);

    // Reverse old movement and apply new one
    if (oldMovement) {
      this.updateAccountBalances(oldMovement, 'remove');
      this.updateAccountBalances(movement, 'add');
    }
  }

  deleteMovement(id: string): void {
    const byAccount = { ...this.movementsByAccount$.value };
    let movement: Movement | undefined;
    
    // Search in all accounts for the movement to delete
    for (const accountId in byAccount) {
      const found = byAccount[accountId].find(m => m.id === id);
      if (found) {
        movement = found;
        byAccount[accountId] = byAccount[accountId].filter(m => m.id !== id);
        break;
      }
    }
    
    this.saveToCache(byAccount);

    // Reverse the movement's balance effect
    if (movement) {
      this.updateAccountBalances(movement, 'remove');
    }
  }

  categorizeMovement(id: string, categoryId: string | null, subcategoryId: string | null): void {
    const byAccount = { ...this.movementsByAccount$.value };
    
    // Search in all accounts for the movement to categorize
    for (const accountId in byAccount) {
      const index = byAccount[accountId].findIndex(m => m.id === id);
      if (index !== -1) {
        byAccount[accountId] = byAccount[accountId].map(m =>
          m.id === id ? { ...m, categoryId, subcategoryId } : m
        );
        break;
      }
    }
    
    this.saveToCache(byAccount);
  }

  deleteAll(): void {
    this.saveToCache({});
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
    const result = this.checkDuplicate(movement, hasOperationNumber);
    return result.status === 'CONFIRMED';
  }

  /**
   * Check for duplicates with detailed status
   * Returns: { status: 'NONE' | 'POTENTIAL' | 'CONFIRMED', duplicateOfId: string | null }
   */
  checkDuplicate(movement: Movement, hasOperationNumber: boolean): { status: 'NONE' | 'POTENTIAL' | 'CONFIRMED', duplicateOfId: string | null } {
    const accountMovements = this.movementsByAccount$.value[movement.accountOrCardId] || [];
    const rules = this.getDuplicateDetectionRules();

    if (hasOperationNumber && movement.operationNumber) {
      // Account movement - check by operation number
      const duplicate = accountMovements.find(e =>
        e.operationNumber === movement.operationNumber
      );
      return duplicate 
        ? { status: 'CONFIRMED', duplicateOfId: duplicate.id }
        : { status: 'NONE', duplicateOfId: null };
    } else {
      // Credit card movement - use smart comparison
      const importedDate = new Date(movement.date);
      const isNonPEN = movement.currency !== 'PEN';
      const accountType = this.getAccountType(movement);
      const importedDescNorm = this.normalize(movement.bankDescription);

      // First, check for exact or contained description matches
      const exactMatch = accountMovements.find(e => {
        if (e.currency !== movement.currency || e.amount !== movement.amount) return false;

        const existingDate = new Date(e.date);
        let dateMatches = existingDate.toDateString() === importedDate.toDateString();

        if (!dateMatches && isNonPEN) {
          const daysDiff = Math.abs(Math.floor((importedDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)));
          dateMatches = daysDiff <= 3;
        }
        if (!dateMatches) return false;

        const existingDescNorm = this.normalize(e.bankDescription);

        // Exact match or strong containment
        if (existingDescNorm === importedDescNorm) return true;
        if (existingDescNorm.includes(importedDescNorm) || importedDescNorm.includes(existingDescNorm)) return true;

        return false;
      });

      if (exactMatch) {
        return { status: 'CONFIRMED', duplicateOfId: exactMatch.id };
      }

      // Check for potential duplicates (same amount, date, currency but description differs)
      const potentialMatch = accountMovements.find(e => {
        if (e.currency !== movement.currency || e.amount !== movement.amount) return false;

        const existingDate = new Date(e.date);
        let dateMatches = existingDate.toDateString() === importedDate.toDateString();

        if (!dateMatches && isNonPEN) {
          const daysDiff = Math.abs(Math.floor((importedDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)));
          dateMatches = daysDiff <= 3;
        }
        
        // Date, amount, currency match but description is different
        return dateMatches;
      });

      if (potentialMatch) {
        return { status: 'POTENTIAL', duplicateOfId: potentialMatch.id };
      }

      // Last resort: apply duplicate-detection rules
      const importedDescNormForRules = importedDescNorm;
      const matchedRules = rules.filter(rule => {
        if (rule.accountType !== 'all' && rule.accountType !== accountType) return false;
        if (rule.currencies.indexOf('all') === -1 && !rule.currencies.includes(movement.currency)) return false;
        const normalizedGroup = rule.descriptionGroup.map(d => this.normalize(d));
        return normalizedGroup.includes(importedDescNormForRules);
      });

      if (matchedRules.length === 0) {
        return { status: 'NONE', duplicateOfId: null };
      }

      // Check existing movements against matched rule groups
      const ruleMatch = accountMovements.find(e => {
        if (e.currency !== movement.currency || e.amount !== movement.amount) return false;

        const existingDate = new Date(e.date);
        let dateMatches = existingDate.toDateString() === importedDate.toDateString();
        if (!dateMatches && isNonPEN) {
          const daysDiff = Math.abs(Math.floor((importedDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)));
          dateMatches = daysDiff <= 3;
        }
        if (!dateMatches) return false;

        const existingDescNorm = this.normalize(e.bankDescription);

        for (const rule of matchedRules) {
          const normalizedGroup = rule.descriptionGroup.map(d => this.normalize(d));
          if (normalizedGroup.includes(existingDescNorm)) return true;
          if (normalizedGroup.some(g => existingDescNorm.includes(g) || g.includes(existingDescNorm))) return true;
        }

        return false;
      });

      return ruleMatch
        ? { status: 'CONFIRMED', duplicateOfId: ruleMatch.id }
        : { status: 'NONE', duplicateOfId: null };
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
    const cachedByAccount = this.fetchFromLocalStorage<MovementsByAccount>(Constants.StorageTags.MOVEMENTS_BY_ACCOUNT);
    
    if (cachedByAccount) {
      // Parse dates from string format
      const parsedByAccount: MovementsByAccount = {};
      Object.keys(cachedByAccount).forEach(accountId => {
        parsedByAccount[accountId] = cachedByAccount[accountId].map(m => ({
          ...m,
          date: new Date(m.date)
        }));
      });
      this.movementsByAccount$.next(parsedByAccount);
    } else {
      this.movementsByAccount$.next({});
    }
  }

  private saveToCache(byAccount: MovementsByAccount): void {
    this.storeInLocalStorage(byAccount, Constants.StorageTags.MOVEMENTS_BY_ACCOUNT);
    this.movementsByAccount$.next(byAccount);
  }

  // Call this in your app to initialize default detection rules if none exist
  initializeDefaultDetectionRules(defaultDataService: any): void {
    const rules = this.fetchFromLocalStorage<DuplicateDetectionRule[]>(Constants.StorageTags.DUPLICATE_DETECTION_RULES);
    if (!rules || rules.length === 0) {
      const defaultRules = defaultDataService.getDefaultDetectionRules();
      this.storeInLocalStorage(defaultRules, Constants.StorageTags.DUPLICATE_DETECTION_RULES);
    }
  }
}
