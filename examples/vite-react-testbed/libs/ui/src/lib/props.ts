/**
 * Props shared across the kit. Every component's props type is assembled from these,
 * which is the normal shape for a React library — and the reason the ACM analyzer
 * resolves props across modules rather than only within the declaring file.
 */

import type { ReactNode } from 'react';

/** Layout knobs every surface in the kit accepts. */
export interface Spacing {
  /** Outer margin, in 4px grid units. */
  gap?: number;
  /** Inner padding, in 4px grid units. */
  pad?: number;
}

/** The contract every component in the kit honours. */
export interface SurfaceBase extends Spacing {
  /** Stable hook for test automation. */
  testId?: string;
  /** Extra class names appended to the root element. */
  className?: string;
}

/** Anything that renders projected content. */
export interface WithChildren {
  /** Default content. */
  children?: ReactNode;
}

/** Sizes shared by the kit's interactive controls. */
export type ControlSize = 'small' | 'medium' | 'large';

/** Status colours shared by Alert, Badge, and Toast-like surfaces. */
export type StatusTone = 'info' | 'success' | 'warning' | 'error';

/** The common shape of a form control. */
export interface FieldBase extends SurfaceBase {
  /** Text shown above the control. */
  label: string;
  /** Explanatory text shown below the control. */
  hint?: string;
  /** Validation message; presence puts the field in its error state. */
  error?: string;
  /** Whether the control rejects input. */
  disabled?: boolean;
  /** Whether the control must be filled before submission. */
  required?: boolean;
}
