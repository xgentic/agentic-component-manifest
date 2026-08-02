import { Component, input } from '@angular/core';

/**
 * A round image representing a user or entity.
 * @acmSemantic avatar - Identifies a person or entity; `alt` is the accessible name.
 * @slot - Fallback content shown when no image is available (e.g. initials).
 * @example Image with initials fallback
 * ```html
 * <tb-avatar src="/ada.png" alt="Ada Lovelace" size="large">AL</tb-avatar>
 * ```
 */
@Component({
  selector: 'tb-avatar',
  template: `
    @if (src()) {
      <img [class]="'tb-avatar tb-avatar--' + size()" [src]="src()" [alt]="alt()" />
    } @else {
      <span [class]="'tb-avatar tb-avatar--' + size()"><ng-content></ng-content></span>
    }
  `,
})
export class Avatar {
  /** Image URL; when absent, the projected fallback content is shown. */
  src = input<string>('');

  /** Accessible alt text for the image. */
  alt = input<string>('');

  /** Diameter of the avatar. */
  size = input<'small' | 'medium' | 'large'>('medium');
}
