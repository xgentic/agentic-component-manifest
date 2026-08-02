/**
 * Dev-time React type stubs (testbed-inventory shared assertion #2): the testbed source
 * is authored against these declarations so it typechecks with no runtime React
 * dependency. Kept OUTSIDE `src/` so the analyzer never discovers it — the analyzer is
 * syntax-only and reads the component source directly.
 *
 * `HTMLAttributes` is declared here on purpose: the testbed extends it from a *bare*
 * specifier, which cross-module resolution deliberately refuses to follow (spec 007
 * FR-010), so it must be reachable by the compiler but not by the analyzer.
 */
declare module 'react' {
  export type Key = string | number;
  export interface ReactNode {}
  export interface CSSProperties {
    [property: string]: string | number | undefined;
  }
  export interface HTMLAttributes<T> {
    className?: string;
    style?: CSSProperties;
    id?: string;
  }

  export interface RefObject<T> {
    current: T | null;
  }
  export type Ref<T> = RefObject<T> | ((instance: T | null) => void) | null;

  export interface ForwardRefComponent<H, P> {
    (props: P & { ref?: Ref<H> }): ReactNode;
  }

  export function forwardRef<H, P>(
    render: (props: P, ref: Ref<H>) => ReactNode,
  ): ForwardRefComponent<H, P>;

  export function memo<C>(component: C): C;

  export function useImperativeHandle<H>(ref: Ref<H>, factory: () => H, deps?: unknown[]): void;
  export function useState<S>(initial: S): [S, (next: S) => void];
  export function useMemo<T>(factory: () => T, deps?: unknown[]): T;
  export function useCallback<T>(fn: T, deps?: unknown[]): T;
  export function useRef<T>(initial: T): RefObject<T>;

  const React: {
    forwardRef: typeof forwardRef;
    memo: typeof memo;
    useImperativeHandle: typeof useImperativeHandle;
    useState: typeof useState;
    useRef: typeof useRef;
  };
  export default React;
}

declare namespace JSX {
  interface IntrinsicElements {
    [element: string]: Record<string, unknown>;
  }
  interface Element {}
}
