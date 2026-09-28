import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FEED_TABS, FeedFilter, PROVINCES } from '../../core/models/types';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IconComponent } from './icon.component';
import { LocationService } from '../../core/services/location.service';

/**
 * Feed filter rail: post-type chips, then a real dropdown for the province
 * (tapping it always opens the full list), plus sort and status.
 */
@Component({
  selector: 'lf-filter-bar',
  standalone: true,
  imports: [IconComponent, IonSelect, IonSelectOption],
  template: `
    <div class="bar">
      <div class="lf-scroller chips">
        @for (t of tabs; track t.key) {
          <button class="chip" [class.on]="filter.type === t.key" (click)="setType(t.key)">
            <lf-icon [name]="t.icon" [size]="13" /> {{ t.label }}
            @if (t.key === 'missing' && missingCount > 0) {
              <span class="pip">{{ missingCount }}</span>
            }
          </button>
        }
      </div>

      <div class="row2">
        <!-- province: the value sits right next to its own arrow, no dead gap -->
        <div class="pick selectwrap" [class.on]="filter.province !== 'all'">
          <lf-icon name="pin" [size]="13" />
          <ion-select class="select" [value]="filter.province" placeholder="All provinces"
                      aria-label="Filter by province" interface="action-sheet"
                      (ionChange)="filterChange.emit({ province: $any($event.detail).value })">
            <ion-select-option value="all">All provinces</ion-select-option>
            @for (p of provinces; track p.code) {
              <ion-select-option [value]="p.code">{{ p.name }}</ion-select-option>
            }
          </ion-select>
        </div>

        <button class="pick" [class.on]="filter.sort === 'nearby'" (click)="cycleSort()">
          <lf-icon name="filter" [size]="14" /> {{ sortLabel() }}
        </button>
        <button class="pick" [class.on]="filter.status !== 'active'" (click)="cycleStatus()">
          <lf-icon name="clock" [size]="14" /> {{ statusLabel() }}
        </button>

        <!-- always here, so a filter can never trap you -->
        <button class="pick clear" [class.live]="isFiltered()" (click)="reset.emit()" aria-label="Reset all filters">
          <lf-icon name="refresh" [size]="14" /> Reset
        </button>
      </div>
    </div>
  `,
  styles: [`
    .bar { border-bottom: 0; background: color-mix(in srgb, var(--ion-background-color) 72%, transparent);
      backdrop-filter: blur(16px); position: sticky; top: 0; z-index: 5; }
    .chips { padding: 8px var(--lf-gap) 4px; gap: 8px; }
    .chip { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 8px 14px; border-radius: 999px;
      border: 0; background: var(--lf-card-2); color: var(--lf-muted);
      font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
      transition: transform .12s ease, background .12s ease; }
    .chip:active { transform: scale(.96); }
    .chip.on { background: var(--lf-beacon); color: #1a1200; box-shadow: 0 6px 16px color-mix(in srgb, var(--lf-beacon) 28%, transparent); }
    .pip { background: var(--lf-signal); color: #fff; border-radius: 999px; font-size: 10px;
      padding: 1px 6px; font-weight: 800; }
    .chip.on .pip { background: #1a1200; }
    .row2 { display: flex; gap: 8px; padding: 4px var(--lf-gap) 10px; overflow-x: auto; scrollbar-width: none; }
    .row2::-webkit-scrollbar { display: none; }
    .pick { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 8px 12px; border-radius: 999px;
      border: 0; background: var(--lf-card-2); color: var(--lf-muted);
      font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; }
    .pick.on { color: var(--lf-beacon); border-color: color-mix(in srgb, var(--lf-beacon) 50%, transparent); }
    .pick.clear { color: var(--lf-signal); }
    /* the select is wrapped so its text hugs the pin icon and the arrow,
       instead of floating in the middle of a fixed-width box */
    .selectwrap { display: inline-flex; align-items: center; gap: 5px; padding-left: 11px; }
    .select { --placeholder-color: var(--lf-muted); --placeholder-opacity: 1;
      --padding-start: 0; --padding-end: 2px;
      min-width: 0; width: auto; max-width: 150px;
      font-size: 12.5px; font-weight: 600; }
    .select::part(icon) { margin-inline-start: 2px; }
    .select::part(text) { margin: 0; }
    .pick.clear { color: var(--lf-muted); opacity: .6; }
    .pick.clear.live { color: var(--lf-signal); opacity: 1; border-color: color-mix(in srgb, var(--lf-signal) 45%, transparent); }
  `]
})
export class FilterBarComponent {
  @Input({ required: true }) filter!: FeedFilter;
  @Input() missingCount = 0;
  @Output() filterChange = new EventEmitter<Partial<FeedFilter>>();
  @Output() reset = new EventEmitter<void>();

  private location = inject(LocationService);
  protected readonly tabs = FEED_TABS;
  protected readonly provinces = PROVINCES;

  setType(t: FeedFilter['type']): void {
    this.filterChange.emit({ type: t });
  }

  cycleSort(): void {
    const order: FeedFilter['sort'][] = ['recent', 'hot', 'nearby', 'oldest'];
    const next = order[(order.indexOf(this.filter.sort) + 1) % order.length];
    this.filterChange.emit({ sort: next });
  }

  cycleStatus(): void {
    const order: FeedFilter['status'][] = ['active', 'all', 'found'];
    const next = order[(order.indexOf(this.filter.status) + 1) % order.length];
    this.filterChange.emit({ status: next });
  }

  /** Anything other than the defaults - drives how loud the Reset button is. */
  isFiltered(): boolean {
    const f = this.filter;
    return f.type !== 'all' || f.province !== 'all' || f.status !== 'active' || f.sort !== 'recent' || !!f.query;
  }

  sortLabel(): string {
    return { recent: 'Most recent', hot: 'Most shared', nearby: 'Near me', oldest: 'Oldest first' }[this.filter.sort];
  }

  statusLabel(): string {
    if (this.filter.type === 'danger') {
      return { active: 'Still happening', all: 'All alerts', found: 'Found' }[this.filter.status];
    }
    return { active: 'Still missing', all: 'All cases', found: 'Found' }[this.filter.status];
  }

  /** "Near me" uses the province the phone is in. */
  nearMe(): void {
    this.filterChange.emit({ province: this.location.province(), sort: 'nearby' });
  }
}
