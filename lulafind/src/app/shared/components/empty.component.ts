import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IconComponent } from './icon.component';

@Component({
  selector: 'lf-empty',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="lf-empty">
      <lf-icon [name]="icon" [size]="40" />
      <h3>{{ title }}</h3>
      <p>{{ message }}</p>
      @if (actionLabel) {
        <button class="lf-btn lf-btn--primary" (click)="action.emit()">{{ actionLabel }}</button>
      }
    </div>
  `
})
export class EmptyComponent {
  @Input() icon = 'search';
  @Input() title = 'Nothing here yet';
  @Input() message = '';
  @Input() actionLabel = '';
  @Output() action = new EventEmitter<void>();
}
