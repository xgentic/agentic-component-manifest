import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * A checkable input for a binary choice.
 * @slot label - Label content shown next to the checkbox (ng-content select="[label]").
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
