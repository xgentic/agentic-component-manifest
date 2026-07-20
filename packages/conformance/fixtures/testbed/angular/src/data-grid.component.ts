import {
  booleanAttribute,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  inject,
  input,
  model,
  output,
  Output,
  signal,
} from '@angular/core';
import type { GridColumn, RowActivateEvent, RowData, SortEvent } from './support.js';

/** Injection token for grid-wide configuration (DI internals, not API surface). */
declare const GRID_CONFIG: unknown;

/**
 * A themable, sortable, selectable data grid as a standalone Angular component.
 *
 * The maximally complex Angular capability surface: decorated and signal inputs,
 * two-way `model()` bindings, decorator and signal outputs, projected content,
 * host-level CSS custom properties, imperative methods, and ignored DI internals.
 * @slot - Default cell content projected into each cell.
 * @slot header - Header renderer (ng-content select="[header]").
 * @slot toolbar - Toolbar shown above the grid (ng-content select="[toolbar]").
 * @slot footer - Footer shown below the grid (ng-content select="[footer]").
 * @cssprop {<color>} [--acme-grid-border=#ccc] - Grid border color.
 * @cssprop {<length>} [--acme-grid-row-height=36px] - Height of a data row.
 * @cssprop {<color>} [--acme-grid-accent=#06c] - Accent color for selection.
 */
@Component({
  selector: 'acme-data-grid',
  standalone: true,
  host: { class: 'acme-data-grid' },
  template: `
    <div part="toolbar"><ng-content select="[toolbar]"></ng-content></div>
    <div part="header"><ng-content select="[header]"></ng-content></div>
    <div part="body"><ng-content></ng-content></div>
    <div part="footer"><ng-content select="[footer]"></ng-content></div>
  `,
})
export class AcmeDataGridComponent {
  /** Accessible label, bound through the `data-label` attribute. */
  @Input('data-label') label: string = 'Grid';

  /** Whether the grid is disabled; coerced from its attribute. */
  @Input({ transform: booleanAttribute }) disabled: boolean = false;

  /** Visual density of the rows. */
  density = input<'compact' | 'comfortable'>('comfortable');

  /** Column definitions, in display order. */
  columns = input<GridColumn<RowData>[]>([]);

  /** Resolver returning a CSS class for a given row. */
  rowClass = input<(row: RowData) => string>(() => '');

  /** Opaque render configuration nested beyond the structured-type depth bound. */
  renderConfig = input<{ a: { b: { c: { d: { e: { f: string } } } } } }>();

  /** Rows per page; required at the call site. */
  pageSize = input.required<number>();

  /** Maximum number of rows to render before virtualizing. */
  size = input<number>(200);

  /** Currently selected row ids; two-way bound with `[(selection)]`. */
  selection = model<readonly string[]>([]);

  /** Active page index; two-way bound with `[(page)]`. */
  page = model<number>(0);

  caption = input<string>('');

  /** Fired when the active column sort changes. */
  sortChange = output<SortEvent>();

  /** Fired when a row is activated by pointer or keyboard. */
  @Output() rowActivate = new EventEmitter<RowActivateEvent>();

  /** Reflected density class on the host element. */
  @HostBinding('class.dense')
  get denseClass(): boolean {
    return this.density() === 'compact';
  }

  private config = inject<Record<string, unknown>>(GRID_CONFIG);

  private _cache = new Map<string, RowData>();

  protected hoveredIndex = -1;

  private _revision = signal(0);

  ngOnInit(): void {
    this._revision.set(1);
  }

  /**
   * Sort the grid by a column.
   * @param columnId - The column to sort by.
   * @param direction - Sort direction; ascending by default.
   */
  sortBy(columnId: string, direction: 'asc' | 'desc' = 'asc'): void {
    this.sortChange.emit({ columnId, direction });
  }

  /** Reload the grid's data, optionally cancelling via a signal. */
  async refresh(signal?: AbortSignal): Promise<void> {
    void signal;
    void this.config;
  }

  /** Scroll the given row index into view and activate it. */
  scrollToRow(index: number): void {
    this.hoveredIndex = index;
    this.rowActivate.emit({ rowId: String(index) });
  }
}
