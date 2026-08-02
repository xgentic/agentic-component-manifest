import type { ReactNode } from 'react';
import type { SurfaceBase, WithChildren } from './props.js';

interface CardProps extends SurfaceBase, WithChildren {
  /** Heading shown at the top of the card. */
  title?: string;
  /** Elevation step, 0–3; higher casts a deeper shadow. */
  elevation?: number;
  /** Whether the card responds to pointer interaction. */
  interactive?: boolean;
}

/**
 * Groups related content on a raised surface.
 * @acmSemantic card - Groups related content as one unit; the title names the group.
 * @slot header - Replaces the default title row.
 * @slot footer - Actions shown at the bottom of the card.
 * @cssprop {<length>} [--tb-card-radius=8px] - Corner radius of the card.
 * @csspart body - The card's content region.
 * @example Interactive summary card
 * ```tsx
 * const summary = (
 *   <Card title="Invoice #1042" elevation={2} interactive>
 *     Due in 14 days.
 *   </Card>
 * );
 * ```
 */
export function Card({ elevation = 1, interactive = false, title, children }: CardProps): ReactNode {
  return (
    <section className={`tb-card tb-card--e${elevation}`} data-interactive={interactive}>
      {title ? <h3>{title}</h3> : null}
      <div part="body">{children}</div>
    </section>
  );
}
