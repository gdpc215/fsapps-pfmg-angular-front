import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Movement } from '../types/movement';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class MovementService extends BaseService {

  private movements$ = new BehaviorSubject<Movement[]>([]);

  constructor() {
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
  }

  addMovements(movements: Movement[]): void {
    const newMovements = movements.map(m => ({ ...m, id: Utilities.generateUUID() }));
    const allMovements = [...this.movements$.value, ...newMovements];
    this.saveToCache(allMovements);
  }

  updateMovement(movement: Movement): void {
    const movements = this.movements$.value.map(m =>
      m.id === movement.id ? movement : m
    );
    this.saveToCache(movements);
  }

  deleteMovement(id: string): void {
    const movements = this.movements$.value.filter(m => m.id !== id);
    this.saveToCache(movements);
  }

  categorizeMovement(id: string, categoryId: string | null, subcategoryId: string | null): void {
    const movements = this.movements$.value.map(m =>
      m.id === id ? { ...m, categoryId, subcategoryId } : m
    );
    this.saveToCache(movements);
  }

  /**
   * Detect new movements from imported data by comparing with existing movements
   * For accounts: compare by operation number if available
   * For cards: compare by date, description, currency, and amount
   */
  detectNewMovements(importedMovements: Movement[], hasOperationNumber: boolean): Movement[] {
    const existing = this.movements$.value;
    
    return importedMovements.filter(imported => {
      if (hasOperationNumber && imported.operationNumber) {
        // Account movement - check by operation number
        return !existing.some(e => 
          e.operationNumber === imported.operationNumber && 
          e.accountOrCardId === imported.accountOrCardId
        );
      } else {
        // Card movement - check by all fields
        return !existing.some(e =>
          e.accountOrCardId === imported.accountOrCardId &&
          e.date.toString() === imported.date.toString() &&
          e.description === imported.description &&
          e.currency === imported.currency &&
          e.amount === imported.amount
        );
      }
    });
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
