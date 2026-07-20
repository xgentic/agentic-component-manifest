/**
 * A themable on/off toggle rendered as a custom element.
 * @acmSemantic switch - Reflects an on/off state; the label names the action.
 * @example Basic usage
 * ```ts
 * const t = new AcmeToggle();
 * t.checked = true;
 * ```
 * @example Broken — references a member that does not exist (excluded by compile-verify)
 * ```ts
 * const t = new AcmeToggle();
 * t.nonExistentProp = 1;
 * ```
 * @example Markup
 * ```html
 * <acme-toggle checked></acme-toggle>
 * ```
 */
export class AcmeToggle extends HTMLElement {
  /** Whether the toggle is currently on. */
  checked = false;
}
customElements.define("acme-toggle", AcmeToggle);
