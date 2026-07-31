import {
  Component,
  Prop,
  State,
  Event,
  EventEmitter,
  Method,
  Element,
  Listen,
  Watch,
  h,
} from '@stencil/core';
import type {
  GridColumn,
  PageEvent,
  RowActivateEvent,
  RowData,
  SelectionEvent,
  SortEvent,
} from './support';

/**
 * A themable, sortable, selectable data grid rendered as a custom element.
 *
 * The maximally complex Stencil capability surface: decorated `@Prop()`s spanning every
 * structured-type shape, typed `@Event()` emitters, projected slots, opt-in imperative
 * `@Method()`s, themable CSS custom properties and parts, and form association.
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
@Component({ tag: 'acme-data-grid', shadow: true, formAssociated: true })
export class AcmeDataGrid {
  /** How many rows may be selected at once. */
  @Prop() selectionMode: 'single' | 'multi' | 'none' = 'single';

  /** Column definitions, in display order. */
  @Prop() columns: GridColumn<RowData>[] = [];

  /** Resolver returning a CSS class for a given row. */
  @Prop() rowClass: (row: RowData) => string = () => '';

  /** Opaque render configuration nested beyond the structured-type depth bound. */
  @Prop() renderConfig?: {
    a: { b: { c: { d: { e: { f: string } } } } };
  };

  /** Render with denser row spacing; reflected to an attribute. */
  @Prop({ reflect: true }) dense: boolean = false;

  /** Accessible label, surfaced through the `data-label` attribute. */
  @Prop({ attribute: 'data-label' }) label: string = '';

  /** Current filter query; owned by the grid but reassignable from inside. */
  @Prop({ mutable: true }) query: string = '';

  /** Number of rows shown per page. */
  @Prop() pageSize: number = 25;

  /** Whether a data fetch is currently in flight. */
  @Prop() loading: boolean = false;

  /** Text shown when the grid has no rows. */
  @Prop() emptyText: string = 'No rows';

  /** Keep the header visible while the body scrolls; reflected to an attribute. */
  @Prop({ reflect: true }) stickyHeader: boolean = false;

  @Prop() caption: string = '';

  /** Fired when the active column sort changes. */
  @Event() sort!: EventEmitter<SortEvent>;

  /** Fired when the set of selected rows changes. */
  @Event({ eventName: 'selection-change' }) selectionChange!: EventEmitter<SelectionEvent>;

  /** Fired when the active page changes. */
  @Event({ eventName: 'page-change' }) pageChange!: EventEmitter<PageEvent>;

  /** Fired when a row is activated. */
  @Event({ eventName: 'row-activate' }) rowActivate!: EventEmitter<RowActivateEvent>;

  @State() private hoveredRow = -1;

  @Element() private hostEl!: HTMLElement;

  private _cache = new Map<string, RowData>();

  #internalId = 0;

  /**
   * Sort the grid by a column.
   * @param columnId - The column to sort by.
   * @param direction - Sort direction; ascending by default.
   */
  @Method()
  async sortBy(columnId: string, direction: 'asc' | 'desc' = 'asc'): Promise<void> {
    this.sort.emit({ columnId, direction });
  }

  /** Reload the grid's data, optionally cancelling via a signal. */
  @Method()
  async refresh(signal?: AbortSignal): Promise<void> {
    this.loading = true;
    this.pageChange.emit({ page: 1, pageSize: this.pageSize });
    void signal;
  }

  /** Scroll the given row index into view and mark it active. */
  @Method()
  async scrollToRow(index: number): Promise<void> {
    this.hoveredRow = index;
    this.#internalId += 1;
    this.rowActivate.emit({ rowId: String(index) });
    this.selectionChange.emit({ selected: [] });
  }

  /** Not decorated with `@Method()`: an internal helper, absent from the public surface. */
  recompute(): void {
    this._cache.clear();
  }

  @Watch('pageSize')
  onPageSizeChange(): void {}

  @Listen('keydown')
  onKeydown(): void {}

  render() {
    return (
      <div>
        <slot />
      </div>
    );
  }
}
