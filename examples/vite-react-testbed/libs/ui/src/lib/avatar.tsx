import type { ReactNode } from 'react';
import type { ControlSize, SurfaceBase } from './props.js';

interface AvatarProps extends SurfaceBase {
  /** Image source; falls back to initials when absent. */
  src?: string;
  /** Accessible name for the depicted person or entity. */
  name: string;
  /** Size of the avatar. */
  size?: ControlSize;
  /** Shape of the avatar. */
  shape?: 'circle' | 'square';
}

/**
 * Represents a person or entity as an image or initials.
 * @acmSemantic avatar - Identifies a person or entity; `name` is the accessible name.
 * @example Image with initials fallback
 * ```tsx
 * const who = <Avatar name="Ada Lovelace" src="/ada.png" size="large" shape="circle" />;
 * ```
 */
export function Avatar({ size = 'medium', shape = 'circle', src, name }: AvatarProps): ReactNode {
  return src ? (
    <img className={`tb-avatar tb-avatar--${size} is-${shape}`} src={src} alt={name} />
  ) : (
    <span className={`tb-avatar tb-avatar--${size} is-${shape}`}>{name.slice(0, 2)}</span>
  );
}
