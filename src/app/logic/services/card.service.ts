import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Card } from '../types/card';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class CardService extends BaseService {

  private cards$ = new BehaviorSubject<Card[]>([]);

  constructor() {
    super('CardService');
    this.loadFromCache();
  }

  getCards(): Observable<Card[]> {
    return this.cards$.asObservable();
  }

  getCardById(id: string): Card | undefined {
    return this.cards$.value.find(c => c.id === id);
  }

  addCard(card: Card): void {
    card.id = Utilities.generateUUID();
    const cards = [...this.cards$.value, card];
    this.saveToCache(cards);
  }

  updateCard(card: Card): void {
    const cards = this.cards$.value.map(c =>
      c.id === card.id ? card : c
    );
    this.saveToCache(cards);
  }

  deleteCard(id: string): void {
    const cards = this.cards$.value.filter(c => c.id !== id);
    this.saveToCache(cards);
  }

  setCheckpoint(id: string, balance: number): void {
    const cards = this.cards$.value.map(c =>
      c.id === id ? { ...c, lastCheckpointBalance: balance, lastCheckpointDate: new Date() } : c
    );
    this.saveToCache(cards);
  }

  private loadFromCache(): void {
    const cached = this.fetchFromLocalStorage<Card[]>(Constants.StorageTags.CARDS);
    this.cards$.next(cached || []);
  }

  private saveToCache(cards: Card[]): void {
    this.storeInLocalStorage(cards, Constants.StorageTags.CARDS);
    this.cards$.next(cards);
  }
}
