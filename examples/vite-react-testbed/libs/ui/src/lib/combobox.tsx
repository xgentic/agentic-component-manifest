import { forwardRef, useImperativeHandle, useState } from 'react';
import type { ReactNode } from 'react';
import type { FieldBase } from './props.js';

/** One selectable entry in a Combobox. */
export interface ComboboxOption {
  /** Value reported when this option is chosen. */
  value: string;
  /** Text shown in the list. */
  label: string;
  /** Whether the option can be chosen. */
  disabled?: boolean;
  /** Optional group heading this option sorts under. */
  group?: string;
}

/**
 * Combobox takes everything a field takes except the plain error string — it derives its
 * validation message from the loader instead.
 */
type ComboboxProps = Omit<FieldBase, 'error'> & {
  /** Options shown when no loader is supplied. */
  options?: ComboboxOption[];
  /** Currently chosen value. */
  value?: string;
  /** Text typed into the control. */
  inputValue?: string;
  /** Whether the list allows more than one choice. */
  multiple?: boolean;
  /** Whether the control filters its options as the user types. */
  filterable?: boolean;
  /** Message shown when no option matches the query. */
  noResultsMessage?: string;
  /** Fetches options for a query; makes the control async. */
  loadOptions?: (query: string) => Promise<ComboboxOption[]>;
  /** Called with the chosen value when the selection changes. */
  onValueChange?: (value: string) => void;
  /** Called with the typed text on every keystroke. */
  onInputValueChange?: (text: string) => void;
};

/** The imperative surface a Combobox exposes through its ref. */
export interface ComboboxHandle {
  /** Moves keyboard focus into the text input. */
  focus(): void;
  /** Opens the option list. */
  open(): void;
  /** Closes the option list without changing the selection. */
  close(): void;
  /** Re-runs `loadOptions` for the current query. */
  reload(query: string): Promise<void>;
}

/**
 * A text input paired with a filterable list of options, optionally loaded on demand.
 * @slot empty - Replaces the default no-results message.
 * @cssprop {<length>} [--tb-combobox-list-max-height=18rem] - Maximum height of the option list.
 * @csspart list - The option list container.
 * @acmSemantic combobox - Text input paired with a list of suggestions; the input owns the value.
 * @example Static options
 * ```tsx
 * const currency = (
 *   <Combobox
 *     label="Currency"
 *     options={[
 *       { value: 'chf', label: 'Swiss franc' },
 *       { value: 'eur', label: 'Euro', disabled: true },
 *     ]}
 *     onValueChange={(value) => console.log(value)}
 *   />
 * );
 * ```
 * @example Async loading
 * ```tsx
 * const remote = (
 *   <Combobox
 *     label="Customer"
 *     filterable
 *     noResultsMessage="No customers match that name"
 *     loadOptions={async (query) => [{ value: query, label: query }]}
 *     onInputValueChange={(text) => console.log(text)}
 *   />
 * );
 * ```
 */
export const Combobox = forwardRef<ComboboxHandle, ComboboxProps>(function Combobox(
  {
    multiple = false,
    filterable = true,
    noResultsMessage = 'No matches',
    disabled = false,
    label,
    options = [],
  },
  ref,
): ReactNode {
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => {},
    open: () => setOpen(true),
    close: () => setOpen(false),
    reload: async () => {},
  }));

  return (
    <div className="tb-combobox" data-open={open} data-multiple={multiple}>
      <label>{label}</label>
      <input role="combobox" disabled={disabled} data-filterable={filterable} />
      <ul part="list">
        {options.length === 0 ? noResultsMessage : options.map((option) => option.label).join(' ')}
      </ul>
    </div>
  );
});
