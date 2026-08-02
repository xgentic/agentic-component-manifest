import { forwardRef, memo, useImperativeHandle, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SurfaceBase, WithChildren } from './props.js';

/** One row of table data; the `id` is what selection and activation refer to. */
export interface TableRow {
  id: string;
  [column: string]: unknown;
}

/** A typed column definition, parameterized by its row shape. */
export interface TableColumn<Row> {
  /** Key used to identify the column in sort and selection events. */
  id: string;
  /** Text rendered in the column header. */
  header: string;
  /** Extracts this column's cell value from a row. */
  get(row: Row): unknown;
  /** Whether the column can be sorted by the user. */
  sortable?: boolean;
  /** Fixed column width, e.g. `"12rem"`. */
  width?: string;
}

/** Payload describing a change to the active sort. */
export interface SortChange {
  columnId: string;
  direction: 'asc' | 'desc';
}

/** Props contributed by the pagination mixin. */
export type PaginationProps = {
  /** Rows shown per page. */
  pageSize?: number;
  /** Zero-based index of the visible page. */
  page?: number;
  /** Called with the new page index when the user paginates. */
  onPageChange?: (page: number) => void;
};

interface DataTableOwnProps extends SurfaceBase, WithChildren {
  /** Column definitions, in display order. */
  columns: TableColumn<TableRow>[];
  /** Rows to render. */
  rows: TableRow[];
  /** Vertical density of the rows. */
  density?: 'compact' | 'comfortable';
  /** How many rows may be selected at once. */
  selectionMode?: 'single' | 'multi' | 'none';
  /** Ids of the currently selected rows. */
  selection?: readonly string[];
  /** Resolver returning a CSS class for a given row. */
  rowClass?: (row: TableRow) => string;
  /** Message shown when `rows` is empty. */
  emptyMessage?: string;
  /** Called when the selected row set changes. */
  onSelectionChange?: (ids: readonly string[]) => void;
  /** Called when a row is activated by double-click or Enter. */
  onRowActivate?: (row: TableRow) => void;
  /** Called when the user changes the active column sort. */
  onSortChange?: (change: SortChange) => void;
}

/** Everything DataTable accepts: its own props plus pagination. */
export type DataTableProps = DataTableOwnProps & PaginationProps;

/** The imperative surface a DataTable exposes through its ref. */
export interface DataTableHandle {
  /** Moves keyboard focus to the first focusable cell. */
  focusFirstCell(): void;
  /** Selects every row on the current page. */
  selectAllVisible(): void;
  /** Clears the selection without emitting a change. */
  clearSelection(): void;
  /** Scrolls a row into view; resolves once the scroll settles. */
  scrollToRow(rowId: string, behavior?: 'auto' | 'smooth'): Promise<void>;
}

/**
 * A sortable, selectable, paginated table for tabular data.
 *
 * The kit's most complex component: generic column definitions, an imperative handle,
 * projected header and toolbar content, and callback props for every state change.
 * @slot toolbar - Controls shown above the table.
 * @slot empty - Replaces the default empty-state message.
 * @cssprop {<color>} [--tb-table-border=#e2e2e2] - Colour of the cell borders.
 * @cssprop {<length>} [--tb-table-row-height=36px] - Height of a data row.
 * @cssprop {<color>} [--tb-table-accent=#06c] - Accent colour for selected rows.
 * @csspart header - The column header row.
 * @csspart body - The scrollable row container.
 * @acmSemantic grid - Two-dimensional tabular data with selectable, activatable rows.
 * @example Typed columns and rows
 * ```tsx
 * const columns = [
 *   { id: 'name', header: 'Name', get: (row) => row.name, sortable: true },
 *   { id: 'due', header: 'Due', get: (row) => row.due, width: '8rem' },
 * ];
 * const rows = [{ id: '1', name: 'Invoice #1042', due: '2026-08-14' }];
 * const table = <DataTable columns={columns} rows={rows} />;
 * ```
 * @example Multi-select with pagination
 * ```tsx
 * const paged = (
 *   <DataTable
 *     columns={[]}
 *     rows={[]}
 *     selectionMode="multi"
 *     density="compact"
 *     pageSize={50}
 *     page={2}
 *     onPageChange={(next) => console.log(next)}
 *     onSelectionChange={(ids) => console.log(ids.length)}
 *     onSortChange={(change) => console.log(change.columnId, change.direction)}
 *   />
 * );
 * ```
 * @example Empty state and projected toolbar
 * ```tsx
 * const empty = (
 *   <DataTable columns={[]} rows={[]} emptyMessage="No invoices yet">
 *     Toolbar content
 *   </DataTable>
 * );
 * ```
 */
export const DataTable = memo(
  forwardRef<DataTableHandle, DataTableProps>(function DataTable(
    {
      density = 'comfortable',
      selectionMode = 'single',
      pageSize = 25,
      page = 0,
      emptyMessage = 'No rows to show',
      columns,
      rows,
      children,
    },
    ref,
  ): ReactNode {
    const [selected, setSelected] = useState<readonly string[]>([]);
    const visible = useMemo(
      () => rows.slice(page * pageSize, (page + 1) * pageSize),
      [rows, page, pageSize],
    );

    useImperativeHandle(ref, () => ({
      focusFirstCell: () => {},
      selectAllVisible: () => setSelected(visible.map((row) => row.id)),
      clearSelection: () => setSelected([]),
      scrollToRow: async () => {},
    }));

    return (
      <div className={`tb-table tb-table--${density}`} data-selection={selectionMode}>
        {children}
        <div part="header">{columns.map((column) => column.header).join(' ')}</div>
        <div part="body" data-selected={selected.length}>
          {visible.length === 0 ? emptyMessage : visible.map((row) => row.id).join(' ')}
        </div>
      </div>
    );
  }),
);
