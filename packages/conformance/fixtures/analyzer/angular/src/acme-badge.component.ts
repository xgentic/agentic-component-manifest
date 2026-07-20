import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * A compact status badge with classic decorator inputs and outputs.
 * @cssprop {<color>} [--acme-badge-bg=#eee] - Background color of the badge.
 */
@Component({
  selector: 'acme-badge',
  template: '<span><ng-content></ng-content></span>',
})
export class AcmeBadgeComponent {
  /** Text label shown inside the badge. */
  @Input() label: string = '';

  /** Visual tone; required at the call site. */
  @Input({ required: true }) tone!: 'info' | 'warn' | 'error';

  /** Emitted when the badge is dismissed; bound publicly as `cleared`. */
  @Output('cleared') onCleared = new EventEmitter<string>();

  /** Clears the badge text. */
  clear(): void {}
}
