import type { ReactNode } from 'react';
import type { SurfaceBase, WithChildren } from './props.js';

interface TabsProps extends SurfaceBase, WithChildren {
  /** Index of the active tab. */
  selectedIndex?: number;
  /** Called with the new index when the active tab changes. */
  onSelectedIndexChange?: (index: number) => void;
  /** Orientation of the tab strip. */
  orientation?: 'horizontal' | 'vertical';
}

/**
 * A tabbed container that shows one panel at a time.
 * @acmSemantic tabs - Switches between sibling panels; only one panel is visible at a time.
 * @slot tablist - The tab triggers, rendered above the active panel.
 * @example Controlled selection
 * ```tsx
 * const tabs = (
 *   <Tabs selectedIndex={1} onSelectedIndexChange={(i) => console.log(i)}>
 *     Panel content
 *   </Tabs>
 * );
 * ```
 */
export function Tabs({
  selectedIndex = 0,
  orientation = 'horizontal',
  children,
}: TabsProps): ReactNode {
  return (
    <div className={`tb-tabs tb-tabs--${orientation}`} data-selected-index={selectedIndex}>
      {children}
    </div>
  );
}
