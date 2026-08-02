import type { ReactNode } from 'react';
import type { StatusTone, SurfaceBase, WithChildren } from './props.js';

interface AlertProps extends SurfaceBase, WithChildren {
  /** Severity of the alert. */
  type?: StatusTone;
  /** Whether a dismiss control is shown. */
  dismissible?: boolean;
  /** Called when the alert is dismissed via its dismiss control. */
  onDismiss?: () => void;
}

/**
 * Displays a prominent message about status or a required action.
 * @acmSemantic alert - Announces an important message in place; does not steal focus.
 * @slot actions - Action buttons shown alongside the message.
 * @cssprop {<color>} [--tb-alert-accent=#06c] - Accent colour of the leading rule.
 * @example Dismissible error
 * ```tsx
 * const failed = (
 *   <Alert type="error" dismissible onDismiss={() => console.log('dismissed')}>
 *     Could not save your changes.
 *   </Alert>
 * );
 * ```
 */
export function Alert({ type = 'info', dismissible = false, children }: AlertProps): ReactNode {
  return (
    <div className={`tb-alert tb-alert--${type}`} role="alert">
      {children}
      {dismissible ? <button type="button">&times;</button> : null}
    </div>
  );
}
