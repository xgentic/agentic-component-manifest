import * as React from 'react';
import { forwardRef, memo, useImperativeHandle, useState } from 'react';
import type { FC, ReactNode } from 'react';
import type { DismissEvent, FieldBase, Spacing } from './props.js';

/** Props assembled from an imported base plus own members. */
interface TextFieldProps extends FieldBase {
  /** Text shown above the control. */
  label: string;
  /** Visual weight — narrower than the base's, and it wins. */
  tone?: 'subtle' | 'loud';
}

/**
 * A labelled text input, declared through an `FC` annotation.
 * @cssprop {<length>} [--acme-field-radius=4px] - Corner radius of the control.
 */
export const TextField: FC<TextFieldProps> = ({ tone: weight = 'subtle', label }) => (
  <label>
    {label}
    <input className={weight} />
  </label>
);

type BadgeOwn = {
  /** Text rendered inside the badge. */
  text: string;
};

/** Props built by intersecting an inline literal with an imported interface. */
type BadgeProps = BadgeOwn & Spacing;

/** A small count or status marker. */
export const Badge = (props: BadgeProps): ReactNode => <span>{props.text}</span>;

/** The imperative surface a `Dialog` exposes through its ref. */
interface DialogHandle {
  /** Opens the dialog and moves focus into it. */
  open(): void;
  /** Closes the dialog, returning focus to the invoker. */
  close(reason: DismissEvent): void;
  /** Resolves once the closing transition has finished. */
  settled(timeoutMs: number): Promise<void>;
}

/** Everything a dialog takes except the automation hook, which it sets itself. */
type DialogProps = Omit<FieldBase, 'testId'> & {
  /** Accessible name for the dialog. */
  title: string;
  /** Dialog body content. */
  children?: ReactNode;
};

/**
 * A modal dialog, reached through `React.forwardRef` with a property-assignment handle.
 * @fires {DismissEvent} dismiss - Fired when the dialog closes for any reason.
 * @slot header - Replaces the default title row.
 */
export const Dialog = React.forwardRef<DialogHandle, DialogProps>(({ title }, ref) => {
  const [visible, setVisible] = useState(false);
  React.useImperativeHandle(ref, () => ({
    open: () => setVisible(true),
    close: () => setVisible(false),
    settled: async () => {},
  }));
  return visible ? <div role="dialog" aria-label={title} /> : null;
});

/** Props whose base lives in a package the analyzer deliberately does not follow. */
interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Elevation step, 0–4. */
  elevation?: number;
}

/** A raised container, wrapped in both `memo` and `forwardRef`. */
export const Surface = memo(
  forwardRef<HTMLDivElement, SurfaceProps>(({ elevation = 0 }, ref) => (
    <div ref={ref} data-elevation={elevation} />
  )),
);

interface AvatarProps {
  /** Image source for the avatar. */
  src: string;
  /** Pixel size of the rendered square. */
  size?: number;
}

/** A user avatar, written as a class component. */
export class Avatar extends React.Component<AvatarProps> {
  /** Preloads the image so the first paint has no flash. */
  preload(): Promise<void> {
    return Promise.resolve();
  }

  /** Internal cache key; not part of the public API. */
  private _key = '';

  componentDidMount(): void {
    this._key = this.props.src;
  }

  render(): ReactNode {
    return <img src={this.props.src} width={this.props.size} />;
  }
}

/** Module-local helper — never a declaration in the manifest. */
function clampSize(value: number): number {
  return Math.max(0, value);
}

/** Not exported, so it has no module identity and never reaches the manifest. */
const InternalRow = (props: { index: number }): ReactNode => <tr data-i={clampSize(props.index)} />;

/** The kit's page shell, exported as the module default. */
export default function Shell(props: { children?: ReactNode }): ReactNode {
  return <main>{props.children}</main>;
}

void InternalRow;
