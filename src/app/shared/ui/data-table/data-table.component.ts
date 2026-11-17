import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RowAction, RowActionEvent, TableColumn, TableQuery } from './data-table.models';

@Component({
  selector: 'app-data-table',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <!-- Toolbar: search + filters slot -->
      <div class="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center dark:border-slate-700">
        <div class="relative flex-1">
          <label class="sr-only" for="table-search">{{ 'common.search' | transloco }}</label>
          <i class="pi pi-search pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true"></i>
          <input
            id="table-search"
            type="search"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent ps-9 pe-3 text-sm"
            [value]="query().search"
            [placeholder]="'common.search' | transloco"
            (input)="onSearch($event)"
          />
        </div>
        <ng-content select="[filters]" />
      </div>

      @if (loading()) {
        <div class="space-y-2 p-4" role="status" aria-live="polite">
          <span class="sr-only">{{ 'common.loading' | transloco }}</span>
          @for (i of skeletonRows; track i) {
            <div class="h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="flex flex-col items-center gap-3 p-8 text-center" role="alert">
          <i class="pi pi-exclamation-triangle text-3xl text-red-600" aria-hidden="true"></i>
          <p class="text-sm">{{ error() }}</p>
          <button
            type="button"
            class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white"
            (click)="retry.emit()"
          >
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      } @else if (rows().length === 0) {
        <div class="flex flex-col items-center gap-2 p-8 text-center">
          <i class="pi pi-inbox text-3xl text-slate-500" aria-hidden="true"></i>
          <p class="text-sm text-slate-600 dark:text-slate-400">
            {{ emptyMessage() || ('common.empty' | transloco) }}
          </p>
        </div>
      } @else {
        <!-- Desktop / tablet: table -->
        <div class="hidden overflow-x-auto md:block">
          <table class="w-full text-start text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800">
              <tr>
                @for (col of columns(); track col.key) {
                  <th
                    scope="col"
                    class="px-4 py-3 text-start font-semibold"
                    [attr.aria-sort]="ariaSort(col)"
                  >
                    @if (col.sortable) {
                      <button
                        type="button"
                        class="inline-flex min-h-11 items-center gap-1.5"
                        (click)="onSort(col)"
                      >
                        {{ col.header }}
                        <i [class]="sortIcon(col)" aria-hidden="true"></i>
                      </button>
                    } @else {
                      {{ col.header }}
                    }
                  </th>
                }
                @if (actions().length) {
                  <th scope="col" class="px-4 py-3 text-end">
                    <span class="sr-only">{{ 'common.actions' | transloco }}</span>
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track $index) {
                <tr class="border-t border-slate-200 dark:border-slate-700">
                  @for (col of columns(); track col.key) {
                    <td class="px-4 py-3">{{ cellText(row, col) }}</td>
                  }
                  @if (actions().length) {
                    <td class="px-4 py-2 text-end">
                      <div class="inline-flex gap-1">
                        @for (a of visibleActions(row); track a.id) {
                          <button
                            type="button"
                            class="min-h-11 min-w-11 rounded-lg px-3 text-sm font-medium"
                            [class]="a.danger ? 'text-red-600' : 'text-[#2563EB]'"
                            [attr.aria-label]="a.label"
                            (click)="action.emit({ actionId: a.id, row })"
                          >
                            @if (a.icon) {
                              <i [class]="a.icon" aria-hidden="true"></i>
                            } @else {
                              {{ a.label }}
                            }
                          </button>
                        }
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- 360px mobile: card list -->
        <ul class="divide-y divide-slate-200 md:hidden dark:divide-slate-700">
          @for (row of rows(); track $index) {
            <li class="space-y-2 p-4">
              @for (col of columns(); track col.key) {
                <div class="flex justify-between gap-3 text-sm">
                  <span class="text-slate-600 dark:text-slate-400">{{ col.header }}</span>
                  <span class="text-end font-medium">{{ cellText(row, col) }}</span>
                </div>
              }
              @if (actions().length) {
                <div class="flex flex-wrap gap-2 pt-1">
                  @for (a of visibleActions(row); track a.id) {
                    <button
                      type="button"
                      class="min-h-11 rounded-lg border px-4 text-sm font-medium"
                      [class]="a.danger ? 'border-red-600 text-red-600' : 'border-[#2563EB] text-[#2563EB]'"
                      (click)="action.emit({ actionId: a.id, row })"
                    >
                      {{ a.label }}
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ul>

        <!-- Pagination -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-3 text-sm dark:border-slate-700">
          <label class="flex items-center gap-2">
            <span>{{ 'common.rowsPerPage' | transloco }}</span>
            <select
              class="min-h-11 rounded-lg border border-slate-400 bg-transparent px-2"
              (change)="onPageSize($event)"
            >
              @for (s of pageSizes; track s) {
                <option [value]="s" [selected]="s === query().pageSize">{{ s }}</option>
              }
            </select>
          </label>
          <span aria-live="polite">{{ query().page }} / {{ totalPages() }} ({{ total() }})</span>
          <div class="flex gap-2">
            <button
              type="button"
              class="min-h-12 min-w-12 rounded-lg border border-slate-400 disabled:opacity-40"
              [disabled]="query().page <= 1"
              [attr.aria-label]="'common.previous' | transloco"
              (click)="goTo(query().page - 1)"
            >
              <i class="pi pi-angle-left" aria-hidden="true"></i>
            </button>
            <button
              type="button"
              class="min-h-12 min-w-12 rounded-lg border border-slate-400 disabled:opacity-40"
              [disabled]="query().page >= totalPages()"
              [attr.aria-label]="'common.next' | transloco"
              (click)="goTo(query().page + 1)"
            >
              <i class="pi pi-angle-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      }
    </section>
  `,
})
export class DataTableComponent<T extends object> {
  readonly rows = input.required<T[]>();
  readonly columns = input.required<TableColumn<T>[]>();
  readonly total = input<number>(0);
  readonly query = input.required<TableQuery>();
  readonly loading = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly actions = input<RowAction<T>[]>([]);
  readonly emptyMessage = input<string>('');

  readonly queryChange = output<TableQuery>();
  readonly action = output<RowActionEvent<T>>();
  readonly retry = output<void>();

  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly pageSizes = [10, 25, 50];

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.query().pageSize)),
  );

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected cellText(row: T, col: TableColumn<T>): string {
    if (col.cell) return col.cell(row);
    const value = (row as unknown as Record<string, unknown>)[col.key];
    return value === null || value === undefined ? '' : String(value);
  }

  protected visibleActions(row: T): RowAction<T>[] {
    return this.actions().filter((a) => (a.visible ? a.visible(row) : true));
  }

  protected ariaSort(col: TableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!col.sortable) return null;
    const s = this.query().sort;
    if (s?.field !== col.key) return 'none';
    return s.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(col: TableColumn<T>): string {
    const s = this.query().sort;
    if (s?.field !== col.key) return 'pi pi-sort-alt';
    return s.direction === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down';
  }

  protected onSort(col: TableColumn<T>): void {
    const s = this.query().sort;
    const direction = s?.field === col.key && s.direction === 'asc' ? 'desc' : 'asc';
    this.queryChange.emit({ ...this.query(), page: 1, sort: { field: col.key, direction } });
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.queryChange.emit({ ...this.query(), page: 1, search: value });
    }, 300);
  }

  protected onPageSize(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.queryChange.emit({ ...this.query(), page: 1, pageSize: value });
  }

  protected goTo(page: number): void {
    this.queryChange.emit({ ...this.query(), page });
  }
}
