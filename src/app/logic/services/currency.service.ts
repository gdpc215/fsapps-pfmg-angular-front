import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { Currency } from '../types/currency';
import { Utilities } from '../utilities';
import { BaseService } from './base.service';

@Injectable({ providedIn: 'root' })
export class CurrencyService extends BaseService {

  private currencies$ = new BehaviorSubject<Currency[]>([]);

  constructor() {
    super('CurrencyService');
    this.loadFromCache();
  }

  getCurrencies(): Observable<Currency[]> {
    return this.currencies$.asObservable();
  }

  getCurrencyById(id: string): Currency | undefined {
    return this.currencies$.value.find(c => c.id === id);
  }

  addCurrency(currency: Currency): void {
    currency.id = Utilities.generateUUID();
    const currencies = [...this.currencies$.value, currency];
    this.saveToCache(currencies);
  }

  updateCurrency(currency: Currency): void {
    const currencies = this.currencies$.value.map(c =>
      c.id === currency.id ? currency : c
    );
    this.saveToCache(currencies);
  }

  deleteCurrency(id: string): void {
    const currencies = this.currencies$.value.filter(c => c.id !== id);
    this.saveToCache(currencies);
  }

  private loadFromCache(): void {
    const cached = this.fetchFromLocalStorage<Currency[]>(Constants.StorageTags.CURRENCIES);
    this.currencies$.next(cached || []);
  }

  private saveToCache(currencies: Currency[]): void {
    this.storeInLocalStorage(currencies, Constants.StorageTags.CURRENCIES);
    this.currencies$.next(currencies);
  }
}
