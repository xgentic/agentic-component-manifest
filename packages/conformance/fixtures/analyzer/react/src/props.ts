/**
 * Shared props types, deliberately in a module of their own: cross-module resolution
 * (spec 007 FR-006) is the behavior this fixture exists to pin.
 */

export interface Spacing {
  /** Space between the field and its neighbours, in grid units. */
  gap?: number;
  /** Inner padding, in grid units. */
  pad?: number;
}

export interface FieldBase extends Spacing {
  /** Stable hook for test automation. */
  testId?: string;
  /** Visual weight of the field. */
  tone?: string;
}

/** Payload of the dismissal event. */
export interface DismissEvent {
  reason: 'escape' | 'backdrop' | 'programmatic';
}
