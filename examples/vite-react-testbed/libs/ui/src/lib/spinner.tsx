import type { ReactNode } from 'react';
import type { ControlSize, SurfaceBase } from './props.js';

interface SpinnerProps extends SurfaceBase {
  /** Size of the spinner. */
  size?: ControlSize;
  /** Text announced to assistive technology while the spinner is visible. */
  label?: string;
}

/**
 * Indicates that work is in progress and its duration is unknown.
 * @acmSemantic progressbar - Indeterminate progress; use a determinate meter when a percentage is known.
 * @cssprop {<color>} [--tb-spinner-color=currentColor] - Stroke colour of the spinner.
 * @example Inline loading state
 * ```tsx
 * const busy = <Spinner size="small" label="Loading results" />;
 * ```
 */
export function Spinner({ size = 'medium', label = 'Loading' }: SpinnerProps): ReactNode {
  return <span className={`tb-spinner tb-spinner--${size}`} role="status" aria-label={label} />;
}
