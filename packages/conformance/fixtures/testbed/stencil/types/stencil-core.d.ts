/**
 * Dev-time Stencil type stubs (testbed-inventory shared assertion #2): the testbed
 * source is authored against these declarations so it typechecks with no runtime
 * Stencil dependency. Kept OUTSIDE `src/` so the analyzer never discovers it — the
 * analyzer is syntax-only and reads the component source directly.
 */
declare module '@stencil/core' {
  export interface ComponentOptions {
    tag: string;
    shadow?: boolean;
    formAssociated?: boolean;
    styleUrl?: string;
    styles?: string;
  }
  export interface PropOptions {
    reflect?: boolean;
    mutable?: boolean;
    attribute?: string;
  }
  export interface EventOptions {
    eventName?: string;
    bubbles?: boolean;
    composed?: boolean;
  }
  export interface EventEmitter<T = unknown> {
    emit(detail?: T): void;
  }

  export function Component(opts: ComponentOptions): (target: unknown) => void;
  export function Prop(opts?: PropOptions): (target: unknown, key: string) => void;
  export function State(): (target: unknown, key: string) => void;
  export function Event(opts?: EventOptions): (target: unknown, key: string) => void;
  export function Method(): (target: unknown, key: string) => void;
  export function Element(): (target: unknown, key: string) => void;
  export function Listen(eventName: string): (target: unknown, key: string) => void;
  export function Watch(propName: string): (target: unknown, key: string) => void;

  export function h(tag: unknown, props?: unknown, ...children: unknown[]): unknown;
}
