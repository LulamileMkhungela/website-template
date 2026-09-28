import { Component, Input } from '@angular/core';
import { iconPath } from '../../core/theme/icon-registry';

@Component({
  selector: 'lf-icon',
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 24 24'" [attr.width]="size" [attr.height]="size"
         fill="none" stroke="currentColor" [attr.stroke-width]="weight"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path [attr.d]="path" />
    </svg>
  `,
  styles: [`
    :host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; flex-shrink: 0; }
    svg { display: block; }
  `]
})
export class IconComponent {
  @Input() name = 'info';
  @Input() size: number | string = 20;
  @Input() weight: number | string = 2;

  get path(): string {
    return iconPath(this.name) ?? iconPath('info') ?? '';
  }
}
