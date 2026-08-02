/**
 * The grid's props, split across modules on purpose: cross-module resolution (spec 007
 * FR-006 / inventory row R11) is a headline capability of the React plugin, so the
 * testbed exercises it rather than declaring everything in one file.
 */

import type { GridColumn, RowActivateEvent, RowData, SortEvent } from './support.js';

/** Layout knobs shared by every surface in the kit. */
export interface GridSpacing {
  /** Space between the grid and its neighbours, in grid units. */
  gap?: number;
  /** Inner padding of the grid body, in grid units. */
  pad?: number;
}

/** Everything the grid inherits from the kit's common surface contract. */
export interface GridBase extends GridSpacing {
  /** Stable hook for test automation. */
  testId?: string;
  /** Visual density of the rows — widened here, narrowed by the grid itself. */
  density?: string;
  /** Accessible label for the grid region. */
  label?: string;
}

/** The grid's own props, before merging. */
export interface GridOwnProps extends GridBase {
  /** Column definitions, in display order. */
  columns: GridColumn<RowData>[];
  /** Rows to render. */
  rows: RowData[];
  /** Visual density of the rows. */
  density?: 'compact' | 'comfortable';
  /** How many rows may be selected at once. */
  selectionMode?: 'single' | 'multi' | 'none';
  /** Rows per page. */
  pageSize?: number;
  /** Resolver returning a CSS class for a given row. */
  rowClass?: (row: RowData) => string;
  /** Opaque render configuration nested beyond the structured-type depth bound. */
  renderConfig?: { a: { b: { c: { d: { e: { f: string } } } } } };
  /** Called when the active column sort changes. */
  onSortChange?: (event: SortEvent) => void;
  /** Called when a row is activated by pointer or keyboard. */
  onRowActivate?: (event: RowActivateEvent) => void;
  emptyMessage?: string;
  caption?: string;
}

/** Props contributed by the virtualization mixin, intersected in below. */
export type VirtualizationProps = {
  /** Maximum number of rows to render before virtualizing. */
  virtualizeAfter?: number;
};
