import type { ReactNode } from 'react';
import type { StatusTone, SurfaceBase, WithChildren } from './props.js';

interface BadgeProps extends SurfaceBase, WithChildren {
  /** Colour of the badge. */
  tone?: StatusTone | 'neutral';
  /** Whether the badge renders as a filled pill rather than an outline. */
  solid?: boolean;
}

/**
 * A compact count or status marker attached to another element.
 * @acmSemantic badge - Annotates a nearby element with a count or status; never interactive.
 * @example Status marker
 * ```tsx
 * const shipped = <Badge tone="success" solid>Shipped</Badge>;
 * ```
 */
export function Badge({ tone = 'neutral', solid = false, children }: BadgeProps): ReactNode {
  return <span className={`tb-badge tb-badge--${tone}${solid ? ' is-solid' : ''}`}>{children}</span>;
}
