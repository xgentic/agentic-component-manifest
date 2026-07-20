import { LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  GridColumn,
  PageEvent,
  RowActivateEvent,
  RowData,
  SelectionEvent,
  SortEvent,
} from './support.js';

/**
 * A themable, sortable, selectable data grid rendered as a custom element.
 *
 * The maximally complex Lit capability surface: reactive properties spanning every
 * structured-type shape, typed events, projected slots, imperative methods, themable
 * CSS custom properties and parts, and form association.
 * @fires {SortEvent} sort - Fired when the active column sort changes.
 * @fires {SelectionEvent} selection-change - Fired when the set of selected rows changes.
 * @fires {PageEvent} page-change - Fired when the active page changes.
 * @fires {RowActivateEvent} row-activate - Fired when a row is activated.
 * @slot - Default cell content rendered inside each cell.
 * @slot header - Custom header renderer.
 * @slot toolbar - Toolbar shown above the grid.
 * @slot empty - Content shown when there are no rows.
 * @cssprop {<color>} [--acme-grid-border=#ddd] - Grid border color.
 * @cssprop {<length>} [--acme-grid-row-height=32px] - Height of a data row.
 * @cssprop {<color>} [--acme-grid-header-bg=#f5f5f5] - Header background color.
 * @cssprop {<length>} [--acme-grid-gap=8px] - Padding gap inside a cell.
 * @csspart row - A data row element.
 * @csspart cell - A single data cell.
 * @csspart header - The header row element.
 */
@customElement('acme-data-grid')
export class AcmeDataGrid extends LitElement {
  static formAssociated = true;

  /** How many rows may be selected at once. */
  @property() selectionMode: 'single' | 'multi' | 'none' = 'single';

  /** Column definitions, in display order. */
  @property({ attribute: false }) columns: GridColumn<RowData>[] = [];

  /** Resolver returning a CSS class for a given row. */
  @property({ attribute: false }) rowClass: (row: RowData) => string = () => '';

  /** Opaque render configuration nested beyond the structured-type depth bound. */
  @property({ attribute: false }) renderConfig?: {
    a: { b: { c: { d: { e: { f: string } } } } };
  };

  /** Render with denser row spacing; reflected to an attribute. */
  @property({ reflect: true }) dense: boolean = false;

  /** Accessible label, surfaced through the `data-label` attribute. */
  @property({
    attribute: 'data-label',
    converter: { fromAttribute: (v: string | null): string => v ?? '' },
  })
  label: string = '';

  /** Number of rows shown per page. */
  @property() pageSize: number = 25;

  /** Whether a data fetch is currently in flight. */
  @property() loading: boolean = false;

  /** Text shown when the grid has no rows. */
  @property() emptyText: string = 'No rows';

  /** Keep the header visible while the body scrolls; reflected to an attribute. */
  @property({ reflect: true }) stickyHeader: boolean = false;

  @property() caption: string = '';

  @state() private _hoveredRow = -1;

  private _cache = new Map<string, RowData>();

  #internalId = 0;

  static get styles(): unknown {
    return [];
  }

  render(): unknown {
    return null;
  }

  /**
   * Sort the grid by a column.
   * @param columnId - The column to sort by.
   * @param direction - Sort direction; ascending by default.
   */
  sortBy(columnId: string, direction: 'asc' | 'desc' = 'asc'): void {
    this.dispatchEvent(new CustomEvent('sort', { detail: { columnId, direction } }));
  }

  /** Reload the grid's data, optionally cancelling via a signal. */
  async refresh(signal?: AbortSignal): Promise<void> {
    this.loading = true;
    this.dispatchEvent(new CustomEvent('page-change', { detail: { page: 1, pageSize: this.pageSize } }));
    void signal;
  }

  /** Scroll the given row index into view and mark it active. */
  scrollToRow(index: number): void {
    this._hoveredRow = index;
    this.#internalId += 1;
    this.dispatchEvent(new CustomEvent('row-activate', { detail: { rowId: String(index) } }));
    this.dispatchEvent(new CustomEvent('selection-change', { detail: { selected: [] } }));
  }
}
