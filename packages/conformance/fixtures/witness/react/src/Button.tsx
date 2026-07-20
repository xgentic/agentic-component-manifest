import { forwardRef, useImperativeHandle } from 'react';
import type { PressEvent } from '@acme/react';

interface ButtonProps {
  /** Visual variant of the button. */
  variant?: 'primary' | 'secondary';
  /** Disables interaction. */
  disabled?: boolean;
}

interface ButtonHandle {
  focus(): void;
}

/**
 * A themable action button as a JSX function component.
 * @fires {PressEvent} press - Fired on activation via pointer or keyboard.
 * @slot - Button label content (children).
 * @slot icon - Leading icon element.
 * @cssprop {<length>} [--acme-button-radius=4px] - Corner radius of the button.
 */
export const Button = forwardRef<ButtonHandle, ButtonProps>(
  ({ variant = 'primary', disabled = false }, ref) => {
    useImperativeHandle(ref, () => ({
      /** Moves keyboard focus to the button via the imperative handle. */
      focus(): void {},
    }));
    return <button className={variant} disabled={disabled} />;
  },
);
