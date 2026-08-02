import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * A checkable input for a binary choice.
 * @acmSemantic checkbox - One independent on/off choice; use a radio group for exclusive choices.
 * @slot label - Label content shown next to the checkbox (ng-content select="[label]").
 * @example Bound checked state
 * ```html
 * <tb-checkbox [checked]="consent" (changed)="consent = $event">
 *   <span label>Email me receipts</span>
 * </tb-checkbox>
 * ```
 */
@Component({
  selector: 'tb-checkbox',
  template: `
    <label class="tb-checkbox">
      <input
        type="checkbox"
        [checked]="checked"
        [disabled]="disabled"
        (change)="changed.emit($any($event.target).checked)"
      />
      <ng-content select="[label]"></ng-content>
    </label>
  `,
  styleUrl: './checkbox.css',
})
export class Checkbox {
  /** Whether the checkbox is checked. */
  @Input() checked = false;

  /** Whether the checkbox is disabled. */
  @Input() disabled = false;

  /** Fired with the new checked state when the checkbox is toggled. */
  @Output() changed = new EventEmitter<boolean>();
}
