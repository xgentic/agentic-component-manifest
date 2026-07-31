import { Component, input } from '@angular/core';

/**
 * A round image representing a user or entity.
 * @slot - Fallback content shown when no image is available (e.g. initials).
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
