import { Injectable, signal } from '@angular/core';
import { KvStore } from '../data/local-db';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface Settings {
  theme: ThemeMode;
  haptics: boolean;
  pushEnabled: boolean;
  pushMissingOnly: boolean;
  pushProvince: string | 'all';
  pushRadiusKm: number;
  showAnonymousAs: string;
  reduceMotion: boolean;
  autoplayMedia: boolean;
  dataSaving: boolean;
}

const DEFAULTS: Settings = {
  theme: 'light',
  haptics: true,
  pushEnabled: true,
  pushMissingOnly: true,
  pushProvince: 'all',
  pushRadiusKm: 50,
  showAnonymousAs: 'Anonymous',
  reduceMotion: false,
  autoplayMedia: true,
  dataSaving: false
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private store = new KvStore('lulafind.settings');
  readonly settings = signal<Settings>({ ...DEFAULTS, ...this.store.get<Partial<Settings>>('current', {}) });

  update(patch: Partial<Settings>): void {
    const next = { ...this.settings(), ...patch };
    this.settings.set(next);
    this.store.set('current', next);
    this.applyTheme(next.theme);
  }

  applyTheme(mode: ThemeMode): void {
    const root = document.documentElement;
    const dark = mode === 'dark' || (mode === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('lf-dark', !!dark);
    root.classList.toggle('lf-light', !dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0a1024' : '#ffffff');
  }

  init(): void {
    this.applyTheme(this.settings().theme);
  }
}
