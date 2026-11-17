import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { DataTableComponent } from '../data-table/data-table.component';
import {
  RowAction,
  RowActionEvent,
  TableColumn,
  TableQuery,
} from '../data-table/data-table.models';
import { PageToolbarComponent } from '../page-toolbar/page-toolbar.component';

/**
 * Standard list screen: toolbar + add button + action error + data table.
 * Parent owns the data (store) and handles the outputs.
 */
@Component({
  selector: 'app-list-page',
  imports: [HasPermissionDirective, PageToolbarComponent, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-toolbar [title]="title()">
      @if (addLabel()) {
        @if (addPermission(); as perm) {
          <button
            *hasPermission="perm"
            type="button"
            class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white"
            (click)="add.emit()"
          >
            {{ addLabel() }}
          </button>
        } @else {
          <button
            type="button"
            class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white"
            (click)="add.emit()"
          >
            {{ addLabel() }}
          </button>
        }
      }
    </app-page-toolbar>

    @if (actionError(); as msg) {
      <p role="alert" class="mb-3 rounded-lg border border-red-600 p-3 text-sm text-red-600">
        {{ msg }}
      </p>
    }

    <app-data-table
      [rows]="rows()"
      [columns]="columns()"
      [total]="total()"
      [query]="query()"
      [loading]="loading()"
      [error]="loadError()"
      [actions]="actions()"
      [emptyMessage]="emptyMessage()"
      (queryChange)="queryChange.emit($event)"
      (action)="action.emit($event)"
      (retry)="retry.emit()"
    />
  `,
})
export class ListPageComponent<T extends object> {
  readonly title = input.required<string>();
  /** Already-translated button text. Empty means no add button. */
  readonly addLabel = input<string>('');
  /** e.g. 'products.brand.create'. Null means the button is always visible. */
  readonly addPermission = input<string | null>(null);

  readonly rows = input.required<T[]>();
  readonly columns = input.required<TableColumn<T>[]>();
  readonly total = input<number>(0);
  readonly query = input.required<TableQuery>();
  readonly loading = input<boolean>(false);
  readonly loadError = input<string | null>(null);
  readonly actionError = input<string | null>(null);
  readonly actions = input<RowAction<T>[]>([]);
  readonly emptyMessage = input<string>('');

  readonly add = output<void>();
  readonly queryChange = output<TableQuery>();
  readonly action = output<RowActionEvent<T>>();
  readonly retry = output<void>();
}