import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import type { ControlSize, FieldBase } from './props.js';

interface TextFieldProps extends FieldBase {
  /** Current value of the control. */
  value?: string;
  /** Placeholder shown while the control is empty. */
  placeholder?: string;
  /** Input mode of the control. */
  type?: 'text' | 'email' | 'password' | 'search';
  /** Size of the control. */
  size?: ControlSize;
  /** Called on every keystroke with the new value. */
  onValueChange?: (value: string) => void;
}

/** The imperative surface a TextField exposes through its ref. */
export interface TextFieldHandle {
  /** Moves keyboard focus into the control. */
  focus(): void;
  /** Clears the control and notifies listeners. */
  clear(): void;
  /** Selects the control's current contents. */
  selectAll(): void;
}

/**
 * A labelled single-line text input.
 * @acmSemantic textbox - Collects one line of free text; the label names what is collected.
 * @cssprop {<color>} [--tb-field-border=#ccc] - Border colour in the resting state.
 * @csspart input - The underlying input element.
 * @example Required email field
 * ```tsx
 * const email = (
 *   <TextField
 *     label="Email"
 *     type="email"
 *     required
 *     hint="We only use this for receipts."
 *     onValueChange={(next) => console.log(next)}
 *   />
 * );
 * ```
 * @example Search variant in an error state
 * ```tsx
 * const search = <TextField label="Search" type="search" error="No results for that term." />;
 * ```
 */
export const TextField = forwardRef<TextFieldHandle, TextFieldProps>(function TextField(
  { type = 'text', size = 'medium', disabled = false, required = false, label, value },
  ref,
): ReactNode {
  const input = useRef<HTMLInputElement | null>(null);
  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    clear: () => {
      if (input.current) input.current.value = '';
    },
    selectAll: () => input.current?.select(),
  }));
  return (
    <label className={`tb-field tb-field--${size}`}>
      {label}
      <input
        part="input"
        ref={input}
        type={type}
        value={value}
        disabled={disabled}
        required={required}
      />
    </label>
  );
});
