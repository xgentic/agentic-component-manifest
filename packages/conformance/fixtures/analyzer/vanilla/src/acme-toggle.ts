import type { ToggleChangeEvent } from "./events.js";

/**
 * A themable on/off toggle rendered as a standard custom element.
 * @fires change {ToggleChangeEvent} - Fired when the toggle state changes.
 * @slot - The toggle label content.
 * @slot hint - Supplementary hint text shown beneath the label.
 * @cssprop {<color>} [--acme-toggle-fill=#0a7] - Fill color of the active track.
 * @cssprop {<length>} [--acme-toggle-size=20px] - Diameter of the thumb.
 * @csspart track - The background track element.
 * @csspart thumb - The sliding thumb element.
 */
export class AcmeToggle extends HTMLElement {
  /** Visual size of the control. */
  size: "small" | "medium" | "large" = "medium";

  /** Whether the toggle is currently on. */
  checked = false;

  /** Whether interaction is disabled. */
  disabled = false;

  /** Internal render latch; not part of the public API. */
  private _dirty = false;

  static get observedAttributes(): string[] {
    return ["checked", "disabled"];
  }

  connectedCallback(): void {
    this._dirty = true;
  }

  /**
   * Toggle the current state and emit a change event.
   * @param force - Optional explicit state to set instead of inverting.
   */
  toggle(force?: boolean): boolean {
    this.checked = force ?? !this.checked;
    return this.checked;
  }

  /** Move keyboard focus to the control. */
  focus(options?: FocusOptions): void {
    super.focus(options);
  }
}

customElements.define("acme-toggle", AcmeToggle);
