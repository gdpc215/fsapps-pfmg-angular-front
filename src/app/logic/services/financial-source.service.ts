import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Constants } from '../constants';
import { FinancialSource, FinancialSourceType } from '../types/financial-source';
import { Utilities } from '../utilities';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class FinancialSourceService {
  private sources$ = new BehaviorSubject<FinancialSource[]>([]);

  constructor(private storageService: StorageService) {
    this.load();
  }

  getSources(): Observable<FinancialSource[]> {
    return this.sources$.asObservable();
  }

  getCurrentSources(): FinancialSource[] {
    return this.sources$.value;
  }

  getById(id: string): FinancialSource | undefined {
    return this.sources$.value.find((s) => s.id === id);
  }

  getAccounts(): FinancialSource[] {
    return this.sources$.value.filter((s) => s.type === FinancialSourceType.ACCOUNT);
  }

  getCreditCards(): FinancialSource[] {
    return this.sources$.value.filter((s) => s.type === FinancialSourceType.CREDIT_CARD);
  }

  addSource(source: FinancialSource): void {
    source.id = Utilities.generateUUID();
    this.save([...this.sources$.value, source]);
  }

  updateSource(source: FinancialSource): void {
    this.save(this.sources$.value.map((s) => s.id === source.id ? source : s));
  }

  deleteSource(id: string): void {
    this.save(this.sources$.value.filter((s) => s.id !== id));
  }

  private load(): void {
    const cached = this.storageService.get<FinancialSource[]>(Constants.StorageTags.FINANCIAL_SOURCES) || [];
    this.sources$.next(cached);
  }

  private save(sources: FinancialSource[]): void {
    this.storageService.set(Constants.StorageTags.FINANCIAL_SOURCES, sources);
    this.sources$.next(sources);
  }
}
