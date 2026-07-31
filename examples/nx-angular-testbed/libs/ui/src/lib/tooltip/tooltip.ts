import { Component, input } from '@angular/core';

/**
 * Shows a short message near an element on hover or focus.
 * @slot - Element that triggers the tooltip on hover or focus.
 */
@Component({
  selector: 'tb-tooltip',
  template: `
    <span class="tb-tooltip" [attr.data-placement]="placement()" [attr.title]="text()">
      <ng-content></ng-content>
    </span>
  `,
})
export class Tooltip {
  /** Message shown in the tooltip. */
  text = input<string>('');

  /** Preferred side of the trigger element to render the tooltip. */
  placement = input<'top' | 'right' | 'bottom' | 'left'>('top');
}
