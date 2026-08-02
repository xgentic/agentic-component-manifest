import * as React from 'react';
import { forwardRef, memo, useImperativeHandle, useMemo, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import type { GridOwnProps, VirtualizationProps } from './grid-props.js';
import type { RowData } from './support.js';

/**
 * The grid's props: an imported base narrowed with `Omit`, intersected with the
 * virtualization mixin and a local literal, and extended with a base the analyzer
 * deliberately cannot follow (row R11).
 */
interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** Grid body content, rendered into each cell. */
  children?: ReactNode;
}

type AcmeDataGridProps = Omit<GridOwnProps, 'caption'> &
  VirtualizationProps &
  GridProps & {
    /** Caption announced to assistive technology. */
    caption?: string;
  };

/** The imperative surface the grid exposes through its ref. */
interface AcmeDataGridHandle {
  /** Moves keyboard focus to the first focusable cell. */
  focusFirstCell(): void;
  /** Selects every row currently in view. */
  selectAllVisible(): void;
  /** Scrolls the given row into view and resolves once the scroll settles. */
  scrollToRow(rowId: string, behavior?: 'auto' | 'smooth'): Promise<void>;
}

/**
 * A themable, sortable, selectable data grid as a JSX function component.
 *
 * The maximally complex React capability surface: props assembled across modules,
 * literal-union / generic / function / beyond-depth types, destructuring defaults,
 * callback props that stay inputs, an imperative handle, and internal state that never
 * reaches the manifest.
 * @fires {SortEvent} sort-change - Fired when the active column sort changes.
 * @fires {RowActivateEvent} row-activate - Fired when a row is activated.
 * @slot header - Header renderer above the column row.
 * @slot toolbar - Toolbar shown above the grid.
 * @slot footer - Footer shown below the grid.
 * @cssprop {<color>} [--acme-grid-border=#ccc] - Grid border color.
 * @cssprop {<length>} [--acme-grid-row-height=36px] - Height of a data row.
 * @cssprop {<color>} [--acme-grid-accent=#06c] - Accent color for selection.
 * @cssprop {<length>} [--acme-grid-gap=4px] - Gap between grid cells.
 * @csspart body - The scrollable row container.
 * @csspart header - The column header row.
 * @csspart footer - The footer region.
 */
export const AcmeDataGrid = memo(
  forwardRef<AcmeDataGridHandle, AcmeDataGridProps>(
    (
      {
        density: rowDensity = 'comfortable',
        selectionMode = 'single',
        pageSize = 25,
        columns,
        rows,
        children,
      },
      ref,
    ) => {
      const [selected, setSelected] = useState<readonly string[]>([]);
      const visible = useMemo(() => rows.slice(0, pageSize), [rows, pageSize]);

      React.useImperativeHandle(ref, () => ({
        focusFirstCell: () => {},
        selectAllVisible: () => setSelected(visible.map((row) => row.id)),
        scrollToRow: async () => {},
      }));

      return (
        <div className={rowDensity} data-selection={selectionMode} data-selected={selected.length}>
          <div part="header">{columns.map((column) => column.header).join(' ')}</div>
          <div part="body">{children}</div>
          <div part="footer">{renderCount(visible)}</div>
        </div>
      );
    },
  ),
);

/** Module-local helper — never a declaration in the manifest. */
function renderCount(rows: readonly RowData[]): string {
  return `${rows.length} rows`;
}

/** Not exported, so it has no module identity and never reaches the manifest. */
const GridRow = (props: { row: RowData }): ReactNode => <div data-id={props.row.id} />;

void GridRow;
