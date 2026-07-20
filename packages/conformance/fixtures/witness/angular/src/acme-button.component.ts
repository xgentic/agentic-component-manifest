import { Component, input, model, output } from '@angular/core';
import type { PressEvent } from '@acme/ng';

/**
 * A themable action button with signal inputs and two-way binding.
 * @slot - Button label content (default ng-content).
 * @slot icon - Leading icon (ng-content select="[icon]").
 * @cssprop {<length>} [--acme-button-radius=4px] - Corner radius of the button.
 */
@Component({
  selector: 'acme-button',
  standalone: true,
  template:
    '<button><ng-content></ng-content><ng-content select="[icon]"></ng-content></button>',
})
export class AcmeButtonComponent {
  /** Visual variant of the button (signal input). */
  variant = input<'primary' | 'secondary'>('primary');

  /** Toggle state; supports [(pressed)] two-way binding. */
  pressed = model<boolean>(false);

  /** Fired on activation via pointer or keyboard. */
  press = output<PressEvent>();

  /** Moves keyboard focus to the button. */
  focus(): void {}
}
