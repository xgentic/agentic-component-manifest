import { Component, input, model } from '@angular/core';

/**
 * A single-line text input.
 * @acmSemantic textbox - Collects one line of free text; the label names what is collected.
 * @slot label - Field label shown above the input (ng-content select="[label]").
 * @example Two-way bound value
 * ```html
 * <tb-text-field [(value)]="email" placeholder="you@example.com">
 *   <span label>Email</span>
 * </tb-text-field>
 * ```
 */
@Component({
  selector: 'tb-text-field',
  template: `
    <label class="tb-text-field">
      <ng-content select="[label]"></ng-content>
      <input
        [value]="value()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        (input)="value.set($any($event.target).value)"
      />
    </label>
  `,
  styleUrl: './text-field.css',
})
export class TextField {
  /** Current text value; two-way bound with `[(value)]`. */
  value = model<string>('');

  /** Placeholder text shown when the field is empty. */
  placeholder = input<string>('');

  /** Whether the field is disabled. */
  disabled = input<boolean>(false);
}
