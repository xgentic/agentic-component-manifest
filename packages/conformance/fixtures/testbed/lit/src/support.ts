/** Supporting types referenced by the data grid (kept out of the manifest surface). */

/** One row of arbitrary grid data. */
export interface RowData {
  id: string;
  [column: string]: unknown;
}

/** A typed column definition, parameterized by its row shape. */
export interface GridColumn<Row> {
  id: string;
  header: string;
  get(row: Row): unknown;
}

/** Payload of the `sort` event. */
export interface SortEvent {
  columnId: string;
  direction: 'asc' | 'desc';
}

/** Payload of the `selection-change` event. */
export interface SelectionEvent {
  selected: readonly string[];
}

/** Payload of the `page-change` event. */
export interface PageEvent {
  page: number;
  pageSize: number;
}

/** Payload of the `row-activate` event. */
export interface RowActivateEvent {
  rowId: string;
}
