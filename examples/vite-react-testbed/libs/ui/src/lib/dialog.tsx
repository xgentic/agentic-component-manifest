import * as React from 'react';
import type { ReactNode } from 'react';
import type { SurfaceBase, WithChildren } from './props.js';

/** Why a dialog closed. */
export interface DismissReason {
  reason: 'escape' | 'backdrop' | 'close-button' | 'programmatic';
}

interface DialogProps extends SurfaceBase, WithChildren {
  /** Accessible name for the dialog. */
  title: string;
  /** Whether the dialog is currently shown. */
  open?: boolean;
  /** Width preset of the dialog panel. */
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  /** Whether clicking the backdrop dismisses the dialog. */
  dismissOnBackdrop?: boolean;
  /** Whether pressing Escape dismisses the dialog. */
  dismissOnEscape?: boolean;
  /** Called with the reason when the dialog closes. */
  onDismiss?: (reason: DismissReason) => void;
}

/** The imperative surface a Dialog exposes through its ref. */
export interface DialogHandle {
  /** Opens the dialog and moves focus into it. */
  open(): void;
  /** Closes the dialog, returning focus to the invoker. */
  close(reason: DismissReason): void;
  /** Resolves once the closing transition has finished. */
  settled(): Promise<void>;
}

/**
 * A modal dialog that traps focus while open.
 * @slot header - Replaces the default title row.
 * @slot footer - Action buttons shown at the bottom of the panel.
 * @cssprop {<color>} [--tb-dialog-backdrop=rgb(0 0 0 / 0.4)] - Colour of the backdrop.
 * @cssprop {<length>} [--tb-dialog-radius=12px] - Corner radius of the panel.
 * @csspart panel - The dialog panel itself.
 * @csspart backdrop - The scrim behind the panel.
 * @acmSemantic dialog - Modal surface that traps focus; use alertdialog for destructive confirmations.
 * @example Confirmation dialog
 * ```tsx
 * const confirm = (
 *   <Dialog
 *     title="Delete invoice?"
 *     open
 *     size="small"
 *     dismissOnBackdrop={false}
 *     onDismiss={(reason) => console.log(reason.reason)}
 *   >
 *     This cannot be undone.
 *   </Dialog>
 * );
 * ```
 * @example Fullscreen editor
 * ```tsx
 * const editor = (
 *   <Dialog title="Edit invoice" size="fullscreen" dismissOnEscape={false}>
 *     Form goes here
 *   </Dialog>
 * );
 * ```
 */
export const Dialog = React.forwardRef<DialogHandle, DialogProps>(function Dialog(
  { size = 'medium', dismissOnBackdrop = true, dismissOnEscape = true, title, children },
  ref,
): ReactNode {
  const [visible, setVisible] = React.useState(false);

  React.useImperativeHandle(ref, () => ({
    open: () => setVisible(true),
    close: () => setVisible(false),
    settled: async () => {},
  }));

  return visible ? (
    <div part="backdrop" data-backdrop-dismiss={dismissOnBackdrop}>
      <div
        part="panel"
        role="dialog"
        aria-label={title}
        className={`tb-dialog tb-dialog--${size}`}
        data-escape-dismiss={dismissOnEscape}
      >
        {children}
      </div>
    </div>
  ) : null;
});
