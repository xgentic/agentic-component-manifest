import type { ReactNode } from 'react';
import type { SurfaceBase, WithChildren } from './props.js';

interface TooltipProps extends SurfaceBase, WithChildren {
  /** Text shown in the tooltip bubble. */
  content: string;
  /** Preferred side of the trigger to render on. */
  placement?: 'top' | 'right' | 'bottom' | 'left';
  /** Delay before the tooltip appears, in milliseconds. */
  openDelay?: number;
}

/**
 * Shows a short explanatory label when its trigger is hovered or focused.
 * @acmSemantic tooltip - Supplementary label for its trigger; never the only source of information.
 * @example Wrapping a trigger
 * ```tsx
 * const hint = (
 *   <Tooltip content="Deletes the invoice permanently" placement="right" openDelay={400}>
 *     Delete
 *   </Tooltip>
 * );
 * ```
 */
export function Tooltip({
  placement = 'top',
  openDelay = 200,
  content,
  children,
}: TooltipProps): ReactNode {
  return (
    <span className={`tb-tooltip tb-tooltip--${placement}`} data-delay={openDelay} title={content}>
      {children}
    </span>
  );
}
