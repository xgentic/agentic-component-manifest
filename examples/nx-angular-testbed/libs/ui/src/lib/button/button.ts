import { Component, input, output } from '@angular/core';

/**
 * Triggers a single action when activated.
 * @slot - Default label content.
 * @slot icon - Leading icon rendered before the label (ng-content select="[icon]").
 */
@Component({
  selector: 'tb-button',
  template: `
    <button [class]="'tb-button tb-button--' + variant() + ' tb-button--' + size()" [disabled]="disabled()" (click)="press.emit($event)">
      <ng-content select="[icon]"></ng-content>
      <ng-content></ng-content>
    </button>
  `,
  styleUrl: './button.css',
})
export class Button {
  /** Visual style of the button. */
  variant = input<'primary' | 'secondary' | 'ghost'>('primary');

  /** Size of the button. */
  size = input<'small' | 'medium' | 'large'>('medium');

  /** Whether the button is disabled. */
  disabled = input<boolean>(false);

  /** Fired when the button is activated by pointer or keyboard. */
  press = output<MouseEvent>();
}
