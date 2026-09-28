import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { BASE_URL } from '../config';

export type PlatformKind = 'web' | 'android' | 'ios';

/**
 * Device capabilities.
 *
 * Capacitor 8 has no `Capacitor.Plugins` registry - plugins are real ES module
 * imports, and each one has a web implementation. That means `Share.share()`
 * opens the phone's own share sheet (WhatsApp, Messages, Gmail, X, Bluetooth…)
 * on a device and falls back to the Web Share API / clipboard in a browser.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly kind: PlatformKind;
  readonly isNative: boolean;
  /** the public address posts are shared with - replace with your real domain */
  readonly baseUrl = BASE_URL;

  constructor() {
    const id = Capacitor.getPlatform();
    this.kind = id === 'android' ? 'android' : id === 'ios' ? 'ios' : 'web';
    this.isNative = Capacitor.isNativePlatform();
  }

  /** Can this device open a real share sheet? */
  async canShare(): Promise<boolean> {
    try {
      const res = await Share.canShare();
      return !!res?.value;
    } catch {
      return false;
    }
  }

  /**
   * Open the phone's share sheet. Returns how it went so the caller can say
   * "Shared" or "Link copied" instead of guessing.
   */
  async share(title: string, text: string, url?: string): Promise<'native' | 'web' | 'clipboard'> {
    const link = url && /^https?:\/\//.test(url) ? url : url ? `${this.baseUrl}${url}` : undefined;
    try {
      const ok = await this.canShare();
      if (ok) {
        await Share.share({ title, text, url: link, dialogTitle: 'Share with' });
        return this.isNative ? 'native' : 'web';
      }
    } catch {
      /* the person closed the sheet - fall through to the clipboard */
    }
    await this.copy(link ? `${text}\n${link}` : text);
    return 'clipboard';
  }

  /** Absolute link for a post, profile or community. */
  link(path: string): string {
    return path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  }

  async copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async haptic(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
    try {
      const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy } as const;
      await Haptics.impact({ style: map[style] });
      return;
    } catch {
      /* plugin unavailable — fall through to the browser */
    }
    if (!this.isNative && 'vibrate' in navigator) {
      try { navigator.vibrate(style === 'heavy' ? 24 : 12); } catch { /* ignore */ }
    }
  }

  async vibrate(ms = 30): Promise<void> {
    if (!this.isNative && 'vibrate' in navigator) {
      try { navigator.vibrate(ms); } catch { /* ignore */ }
    }
  }

  /**
   * Keep fixed bars above the keyboard on iOS and Android.
   * Native uses the Keyboard plugin. The browser preview uses visualViewport,
   * which is what iOS Safari reports when the keyboard covers the page.
   */
  watchKeyboard(): void {
    const apply = (px: number) => {
      document.documentElement.style.setProperty('--keyboard-offset', `${Math.max(0, Math.round(px))}px`);
    };
    const vv = window.visualViewport;
    if (vv) {
      const sync = () => apply(window.innerHeight - vv.height - vv.offsetTop);
      vv.addEventListener('resize', sync);
      vv.addEventListener('scroll', sync);
    }
    if (!this.isNative) return;
    void import('@capacitor/keyboard').then(({ Keyboard }) => {
      void Keyboard.addListener('keyboardWillShow', (info) => apply(info.keyboardHeight));
      void Keyboard.addListener('keyboardDidShow', (info) => apply(info.keyboardHeight));
      void Keyboard.addListener('keyboardWillHide', () => apply(0));
    }).catch(() => undefined);
  }
}
