import type { ReactNode } from 'react';
import type { FieldBase } from './props.js';

interface CheckboxProps extends FieldBase {
  /** Whether the box is ticked. */
  checked?: boolean;
  /** Whether the box shows the mixed state. */
  indeterminate?: boolean;
  /** Called with the new checked state when the box is toggled. */
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * A single on/off choice.
 * @acmSemantic checkbox - One independent on/off choice; use a radio group for exclusive choices.
 * @example Consent checkbox
 * ```tsx
 * const consent = (
 *   <Checkbox label="Email me receipts" required onCheckedChange={(on) => console.log(on)} />
 * );
 * ```
 * @example Mixed "select all" state
 * ```tsx
 * const selectAll = <Checkbox label="Select all" indeterminate />;
 * ```
 */
export function Checkbox({
  checked = false,
  indeterminate = false,
  disabled = false,
  label,
}: CheckboxProps): ReactNode {
  return (
    <label className="tb-checkbox">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-indeterminate={indeterminate}
      />
      {label}
    </label>
  );
}
