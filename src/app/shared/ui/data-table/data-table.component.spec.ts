import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { DataTableComponent } from './data-table.component';
import {
  DEFAULT_TABLE_QUERY,
  RowAction,
  RowActionEvent,
  TableColumn,
  TableQuery,
} from './data-table.models';

interface Row {
  id: number;
  name: string;
}

const columns: TableColumn<Row>[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name', sortable: true },
];

const rows: Row[] = [
  { id: 1, name: 'Dell XPS' },
  { id: 2, name: 'HP Envy' },
];

function setup(inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({
    imports: [
      DataTableComponent,
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
  });
  const fixture = TestBed.createComponent<DataTableComponent<Row>>(DataTableComponent);
  const base: Record<string, unknown> = {
    rows,
    columns,
    total: 25,
    query: { ...DEFAULT_TABLE_QUERY },
    ...inputs,
  };
  for (const [k, v] of Object.entries(base)) fixture.componentRef.setInput(k, v);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('DataTableComponent', () => {
  it('renders rows', () => {
    expect(setup().el.textContent).toContain('Dell XPS');
  });

  it('shows a skeleton while loading, not the rows', () => {
    const { el } = setup({ loading: true });
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Dell XPS');
  });

  it('shows the empty state', () => {
    expect(setup({ rows: [], total: 0 }).el.textContent).toContain('common.empty');
  });

  it('shows the error and a retry button', () => {
    const { fixture, el } = setup({ error: 'Server down' });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Server down');
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));
    (el.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    expect(retried).toBe(true);
  });

  it('emits sort when a sortable header is clicked', () => {
    const { fixture, el } = setup();
    let emitted: TableQuery | undefined;
    fixture.componentInstance.queryChange.subscribe((q) => (emitted = q));
    (el.querySelector('thead button') as HTMLButtonElement).click();
    expect(emitted?.sort).toEqual({ field: 'name', direction: 'asc' });
    expect(emitted?.page).toBe(1);
  });

  it('emits page 2 on next', () => {
    const { fixture, el } = setup();
    let emitted: TableQuery | undefined;
    fixture.componentInstance.queryChange.subscribe((q) => (emitted = q));
    (el.querySelector('button[aria-label="common.next"]') as HTMLButtonElement).click();
    expect(emitted?.page).toBe(2);
  });

  it('emits a row action', () => {
    const actions: RowAction<Row>[] = [{ id: 'edit', label: 'Edit' }];
    const { fixture, el } = setup({ actions });
    let emitted: RowActionEvent<Row> | undefined;
    fixture.componentInstance.action.subscribe((e) => (emitted = e));
    (el.querySelector('tbody button') as HTMLButtonElement).click();
    expect(emitted).toEqual({ actionId: 'edit', row: rows[0] });
  });

  it('hides a row action when visible returns false', () => {
    const actions: RowAction<Row>[] = [{ id: 'delete', label: 'Delete', visible: () => false }];
    const { el } = setup({ actions });
    expect(el.querySelector('tbody button')).toBeNull();
  });
});
