import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Makes navigation feel instant.
 *
 * Every screen is its own lazily-loaded chunk. The first tap used to wait on
 * the network. This walks the route table and imports every screen as soon as
 * the app starts, a few at a time, so the code is already in memory.
 */
@Injectable({ providedIn: 'root' })
export class PrefetchService {
  private router = inject(Router);

  readonly done = signal(false);
  readonly count = signal(0);

  private started = false;

  /** Call once, as early as the app is alive. */
  start(delayMs = 0): void {
    if (this.started) return;
    this.started = true;
    const kick = () => void this.run();
    if (delayMs > 0 && typeof setTimeout !== 'undefined') setTimeout(kick, delayMs);
    else kick();
  }

  /** Pull one screen's code now — used when a tap is imminent. */
  async warm(loader: () => Promise<unknown>): Promise<void> {
    try { await loader(); } catch { /* offline: the normal lazy load will retry */ }
  }

  private async run(): Promise<void> {
    const loaders = collectLoaders(this.router.config);
    const batch = 4;
    for (let i = 0; i < loaders.length; i += batch) {
      await Promise.all(loaders.slice(i, i + batch).map(async (load) => {
        try { await load(); } catch { /* a failed prefetch must never break the app */ }
        this.count.update((n) => n + 1);
      }));
      await this.yieldToUser();
    }
    this.done.set(true);
  }

  private yieldToUser(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });
  }
}

/** Pull every loadComponent / loadChildren out of the route tree. */
function collectLoaders(routes: unknown[], out: Array<() => Promise<unknown>> = []): Array<() => Promise<unknown>> {
  for (const r of routes as Array<Record<string, unknown>>) {
    const lc = r['loadComponent'];
    if (typeof lc === 'function') out.push(lc as () => Promise<unknown>);
    const ll = r['loadChildren'];
    if (typeof ll === 'function') out.push(ll as () => Promise<unknown>);
    const children = r['children'];
    if (Array.isArray(children)) collectLoaders(children, out);
  }
  return out;
}
