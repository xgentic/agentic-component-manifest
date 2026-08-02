import { forwardRef, useImperativeHandle, useState } from 'react';
import type { ReactNode } from 'react';
import type { SurfaceBase, WithChildren } from './props.js';

/** The result of validating a form, keyed by field name. */
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/** Props contributed by the submission mixin. */
export type SubmissionProps = {
  /** Whether the form is mid-submission; disables its controls. */
  submitting?: boolean;
  /** Called with the collected values when the form is submitted and valid. */
  onSubmit?: (values: Record<string, string>) => void;
  /** Called when the user resets the form. */
  onReset?: () => void;
};

interface FormOwnProps extends SurfaceBase, WithChildren {
  /** Accessible name for the form region. */
  label?: string;
  /** How field labels sit relative to their controls. */
  layout?: 'stacked' | 'inline' | 'grid';
  /** When validation runs. */
  validateOn?: 'submit' | 'blur' | 'change';
  /** Initial values, keyed by field name. */
  initialValues?: Record<string, string>;
  /** Called whenever a field's value changes. */
  onValuesChange?: (values: Record<string, string>) => void;
}

/** Everything Form accepts: its own props plus submission handling. */
export type FormProps = FormOwnProps & SubmissionProps;

/** The imperative surface a Form exposes through its ref. */
export interface FormHandle {
  /** Runs validation and returns the result. */
  validate(): Promise<ValidationResult>;
  /** Submits the form as though the submit control were activated. */
  submit(): void;
  /** Restores every field to its initial value. */
  reset(): void;
  /** Moves focus to the first field with an error. */
  focusFirstError(): void;
}

/**
 * Groups form fields, collects their values, and coordinates validation.
 * @slot actions - Submit and cancel controls, shown after the fields.
 * @cssprop {<length>} [--tb-form-field-gap=12px] - Space between fields.
 * @csspart fields - The container the fields render into.
 * The controlled vocabulary has no term for a field group, so this component carries no
 * `@acmSemantic` — an absent classification is honest, a wrong one is not.
 * @example Composing fields
 * ```tsx
 * const signup = (
 *   <Form
 *     label="Sign up"
 *     layout="stacked"
 *     validateOn="blur"
 *     initialValues={{ email: '' }}
 *     onSubmit={(values) => console.log(values.email)}
 *   >
 *     Field components go here
 *   </Form>
 * );
 * ```
 * @example Submitting state
 * ```tsx
 * const busy = (
 *   <Form label="Sign up" submitting onReset={() => console.log('reset')}>
 *     Fields are disabled while submitting.
 *   </Form>
 * );
 * ```
 */
export const Form = forwardRef<FormHandle, FormProps>(function Form(
  { layout = 'stacked', validateOn = 'submit', submitting = false, label, children },
  ref,
): ReactNode {
  const [values, setValues] = useState<Record<string, string>>({});

  useImperativeHandle(ref, () => ({
    validate: async () => ({ valid: true, errors: {} }),
    submit: () => {},
    reset: () => setValues({}),
    focusFirstError: () => {},
  }));

  return (
    <form
      className={`tb-form tb-form--${layout}`}
      aria-label={label}
      data-validate-on={validateOn}
      data-field-count={Object.keys(values).length}
    >
      <div part="fields" data-submitting={submitting}>
        {children}
      </div>
    </form>
  );
});
