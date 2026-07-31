import { Component, Prop, Event, EventEmitter, Method, State, h } from '@stencil/core';
import type { PressEvent } from './events';

/**
 * A themable action button rendered as a custom element.
 * @slot - Button label content.
 * @slot icon - Leading icon.
 * @cssprop {<length>} [--acme-button-radius=4px] - Corner radius of the button.
 * @csspart label - The label span inside the shadow root.
 */
@Component({ tag: 'acme-button', shadow: true })
export class AcmeButton {
  /** Visual variant of the button. */
  @Prop() variant: 'primary' | 'secondary' = 'primary';

  /** Disables pointer and keyboard interaction; reflected to an attribute. */
  @Prop({ reflect: true }) disabled: boolean = false;

  /** Fired on activation via pointer or keyboard. */
  @Event() press!: EventEmitter<PressEvent>;

  /** Internal pressed latch; not part of the public API. */
  @State() private armed: boolean = false;

  /** Moves keyboard focus to the button. */
  @Method()
  async setFocus(): Promise<void> {
    this.armed = true;
  }

  render() {
    return (
      <button>
        <slot />
      </button>
    );
  }
}
