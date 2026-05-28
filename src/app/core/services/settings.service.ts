import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AppSettings, DEFAULT_APP_SETTINGS } from '../models/app-settings.model';
import { SETTINGS_KEY } from './storage-keys';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _settings$ = new BehaviorSubject<AppSettings>(this.load());
  readonly settings$: Observable<AppSettings> = this._settings$.asObservable();

  getSettings(): AppSettings { return this._settings$.getValue(); }

  saveSettings(partial: Partial<AppSettings>): AppSettings {
    const updated: AppSettings = { ...this.getSettings(), ...partial };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch {
      console.error('SettingsService: failed to persist settings');
    }
    this._settings$.next(updated);
    return updated;
  }

  private load(): AppSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { ...DEFAULT_APP_SETTINGS };
      return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
    } catch {
      return { ...DEFAULT_APP_SETTINGS };
    }
  }
}
