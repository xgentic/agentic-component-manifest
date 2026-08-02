import { Component, input } from '@angular/core';

/**
 * A container that groups related content with an optional header and footer.
 * @acmSemantic card - Groups related content as one unit.
 * @slot - Default body content.
 * @slot header - Header content shown above the body (ng-content select="[header]").
 * @slot footer - Footer content shown below the body (ng-content select="[footer]").
 * @example Header, body, and footer
 * ```html
 * <tb-card [elevation]="2">
 *   <h3 header>Invoice #1042</h3>
 *   Due in 14 days.
 *   <tb-button footer variant="primary">Pay now</tb-button>
 * </tb-card>
 * ```
 */
@Component({
  selector: 'tb-card',
  template: `
    <div [class]="'tb-card tb-card--elevation-' + elevation()">
      <div part="header"><ng-content select="[header]"></ng-content></div>
      <div part="body"><ng-content></ng-content></div>
      <div part="footer"><ng-content select="[footer]"></ng-content></div>
    </div>
  `,
  styleUrl: './card.css',
})
export class Card {
  /** Shadow depth, from 0 (flat) to 3 (raised). */
  elevation = input<0 | 1 | 2 | 3>(1);
}
