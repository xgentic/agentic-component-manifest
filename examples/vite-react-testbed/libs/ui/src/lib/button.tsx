import type { ReactNode } from 'react';
import type { ControlSize, SurfaceBase, WithChildren } from './props.js';

interface ButtonProps extends SurfaceBase, WithChildren {
  /** Visual style of the button. */
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Size of the button. */
  size?: ControlSize;
  /** Whether the button is disabled. */
  disabled?: boolean;
  /** Called when the button is activated by pointer or keyboard. */
  onPress?: (event: MouseEvent) => void;
}

/**
 * Triggers a single action when activated.
 * @acmSemantic button - Triggers the action named by its label; not for navigation.
 * @slot icon - Leading icon rendered before the label.
 * @cssprop {<length>} [--tb-button-radius=6px] - Corner radius of the button.
 * @example Primary action
 * ```tsx
 * const save = <Button variant="primary" onPress={() => console.log('saved')}>Save</Button>;
 * ```
 * @example Disabled secondary
 * ```tsx
 * const cancel = <Button variant="secondary" size="small" disabled>Cancel</Button>;
 * ```
 */
export function Button({
  variant = 'primary',
  size = 'medium',
  disabled = false,
  children,
}: ButtonProps): ReactNode {
  return (
    <button className={`tb-button tb-button--${variant} tb-button--${size}`} disabled={disabled}>
      {children}
    </button>
  );
}
