import { Component, input } from '@angular/core';

/**
 * An indeterminate loading indicator.
 * @acmSemantic progressbar - Indeterminate progress; use a determinate meter when a percentage is known.
 * @example Inline loading state
 * ```html
 * <tb-spinner size="small" label="Loading results"></tb-spinner>
 * ```
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
