import { Component, Input } from '@angular/core';

/**
 * A compact label used to display status or a count.
 * @slot - Default content shown inside the badge.
 */
@Component({
  selector: 'tb-badge',
  template: `<span [class]="'tb-badge tb-badge--' + tone"><ng-content></ng-content></span>`,
})
export class Badge {
  /** Visual tone of the badge. */
  @Input() tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' = 'neutral';

  /** Text label, used when no content is projected. */
  @Input() label = '';
}
