import { Component, input } from '@angular/core';

/**
 * An indeterminate loading indicator.
 */
@Component({
  selector: 'tb-spinner',
  template: `<span role="status" [class]="'tb-spinner tb-spinner--' + size()" [attr.aria-label]="label()"></span>`,
})
export class Spinner {
  /** Diameter of the spinner. */
  size = input<'small' | 'medium' | 'large'>('medium');

  /** Accessible label describing what is loading. */
  label = input<string>('Loading');
}
