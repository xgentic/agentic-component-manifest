import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PressEvent } from '@acme/wc';

/**
 * A themable action button rendered as a custom element.
 * @fires {PressEvent} press - Fired on activation via pointer or keyboard.
 * @slot - Button label content.
 * @slot icon - Leading icon.
 * @cssprop {<length>} [--acme-button-radius=4px] - Corner radius of the button.
 * @csspart label - The label span inside the shadow root.
 */
@customElement('acme-button')
export class AcmeButton extends LitElement {
  /** Visual variant of the button. */
  @property() variant: 'primary' | 'secondary' = 'primary';

  /** Disables pointer and keyboard interaction. */
  @property({ reflect: true }) disabled: boolean = false;

  /** Moves keyboard focus to the button. */
  focus(options: FocusOptions): void {
    super.focus(options);
  }
}
