import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export class StorageWriteError extends Error {
  constructor(public readonly key: string, cause: unknown) {
    super(`Failed to write localStorage key "${key}"`);
    this.cause = cause;
  }
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  readonly changes$ = new BehaviorSubject<void>(undefined);

  getAll<T extends { id?: string }>(key: string): T[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown[];
      return parsed.filter((item): item is T =>
        typeof item === 'object' && item !== null && 'id' in item
      );
    } catch {
      console.error(`StorageService: failed to parse key "${key}"`);
      return [];
    }
  }

  save<T extends { id?: string; dateCreation?: string; dateModification?: string }>(
    key: string,
    record: T
  ): T {
    const all = this.getAll<T>(key);
    const now = new Date().toISOString();
    let saved: T;

    if (!record.id) {
      saved = { ...record, id: crypto.randomUUID(), dateCreation: now, dateModification: now };
      all.push(saved);
    } else {
      const idx = all.findIndex((item: any) => item.id === record.id);
      saved = { ...record, dateModification: now };
      if (idx === -1) {
        saved = { ...saved, dateCreation: now };
        all.push(saved);
      } else {
        saved = {
          ...(all[idx] as any),
          ...saved,
          dateCreation: (all[idx] as any).dateCreation ?? now,
          dateModification: now,
        };
        all[idx] = saved;
      }
    }
    this.persist(key, all);
    return saved;
  }

  delete(key: string, id: string): void {
    const all = this.getAll<{ id: string }>(key);
    this.persist(key, all.filter(item => item.id !== id));
  }

  saveAll<T>(key: string, records: T[]): void {
    this.persist(key, records);
  }

  clear(key: string): void {
    localStorage.removeItem(key);
    this.changes$.next();
  }

  getTotalBytes(): number {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      total += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
    }
    return total;
  }

  private persist<T>(key: string, data: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this.changes$.next();
    } catch (err) {
      throw new StorageWriteError(key, err);
    }
  }
}
