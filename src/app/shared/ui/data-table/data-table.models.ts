export type SortDirection = 'asc' | 'desc';

export interface TableSort {
  field: string;
  direction: SortDirection;
}

/** Server ko bhejne wali state. Backend: ?page=&pageSize=&sort=name:asc&search= */
export interface TableQuery {
  page: number; // 1-based
  pageSize: number;
  sort: TableSort | null;
  search: string;
  filters: Record<string, string>;
}

export const DEFAULT_TABLE_QUERY: TableQuery = {
  page: 1,
  pageSize: 10,
  sort: null,
  search: '',
  filters: {},
};

export interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  /** Custom text; na ho to row[key] dikhega. */
  cell?: (row: T) => string;
}

export interface RowAction<T> {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  /** Permission ka check parent yahan karega, e.g. () => can('products.product.edit') */
  visible?: (row: T) => boolean;
}

export interface RowActionEvent<T> {
  actionId: string;
  row: T;
}
