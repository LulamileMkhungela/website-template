import { Component, Input, computed, signal } from '@angular/core';
import { CheckInStatus } from '../../core/models/types';

/**
 * Round avatar with an optional status ring.
 *
 * The ring is how a person's "am I safe?" check-in reads at a glance, anywhere
 * their face appears - profile, feed card, story rail:
 *   safe        -> green
 *   unfamiliar  -> amber
 *   need_help   -> red
 * No status, or a status the viewer is not allowed to see, gets no ring.
 * `ring` still works on its own for the neutral highlight used elsewhere.
 */
@Component({
  selector: 'lf-avatar',
  standalone: true,
  template: `
    @if (!src || failed()) {
      <div class="fallback" [style.width.px]="size" [style.height.px]="size"
           [style.background]="bg" [style.fontSize.px]="size * 0.36"
           [class.ring]="ring && !status" [class.has-status]="!!status"
           [attr.data-status]="status ?? null" role="img" [attr.aria-label]="label"
           [attr.title]="label">{{ text }}</div>
    } @else {
      <img [src]="src" [alt]="label" [style.width.px]="size" [style.height.px]="size"
           [class.ring]="ring && !status" [class.has-status]="!!status"
           [attr.data-status]="status ?? null" [attr.title]="label"
           (error)="failed.set(true)" loading="lazy" decoding="async" />
    }
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    img, .fallback { border-radius: 50%; }
    img { object-fit: cover; display: block; background: var(--lf-card-2); }
    img.ring { padding: 2px; border-radius: 50%;
      background: linear-gradient(135deg, var(--lf-beacon), var(--lf-marigold), var(--lf-signal)); }
    .fallback { display: flex; align-items: center; justify-content: center;
      font-weight: 800; color: #fff; letter-spacing: -0.4px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); }

    /* status rings - the same three colours used on the check-in banner */
    img.has-status, .fallback.has-status { padding: 3px; box-sizing: content-box; }
    img[data-status="safe"], .fallback[data-status="safe"] {
      background: var(--lf-ubuntu);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--lf-ubuntu) 32%, transparent);
    }
    img[data-status="unfamiliar"], .fallback[data-status="unfamiliar"] {
      background: var(--lf-marigold);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--lf-marigold) 32%, transparent);
    }
    img[data-status="need_help"], .fallback[data-status="need_help"] {
      background: var(--lf-signal);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--lf-signal) 38%, transparent);
    }
  `]
})
export class AvatarComponent {
  @Input() src = '';
  @Input() name = '';
  @Input() size = 40;
  @Input() ring = false;
  /** A visible check-in status draws a coloured ring instead of the neutral one. */
  @Input() status: CheckInStatus | null = null;
  failed = signal(false);

  get text(): string {
    return this.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  }

  /** Colour is never the only clue. */
  get label(): string {
    const base = this.name.trim() || 'Profile';
    if (this.status === 'safe') return `${base}, green ring, safe`;
    if (this.status === 'unfamiliar') return `${base}, orange ring, unfamiliar place`;
    if (this.status === 'need_help') return `${base}, red ring, check on me`;
    return base;
  }
  get bg(): string {
    let h = 0;
    for (let i = 0; i < this.name.length; i++) h = (h * 31 + this.name.charCodeAt(i)) % 360;
    return `linear-gradient(135deg, hsl(${h} 58% 42%), hsl(${(h + 40) % 360} 55% 26%))`;
  }
}
