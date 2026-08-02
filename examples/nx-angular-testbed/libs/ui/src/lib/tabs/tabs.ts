import { Component, model } from '@angular/core';

/**
 * A tabbed container that shows one panel at a time.
 * @acmSemantic tabs - Switches between sibling panels; only one panel is visible at a time.
 * @slot - Tab items or panel content.
 * @example Two-way bound selection
 * ```html
 * <tb-tabs [(selectedIndex)]="activeTab">
 *   <section>Panel content</section>
 * </tb-tabs>
 * ```
 */
@Component({
  selector: 'tb-tabs',
  template: `
    <div class="tb-tabs" [attr.data-selected-index]="selectedIndex()">
      <ng-content></ng-content>
    </div>
  `,
})
export class Tabs {
  /** Index of the active tab; two-way bound with `[(selectedIndex)]`. */
  selectedIndex = model<number>(0);
}
