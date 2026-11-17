import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  DEFAULT_TABLE_QUERY,
  RowAction,
  RowActionEvent,
  TableColumn,
} from '../data-table/data-table.models';
import { ListPageComponent } from './list-page.component';

interface Row {
  id: number;
  name: string;
}

const ROWS: Row[] = [
  { id: 1, name: 'Dell' },
  { id: 2, name: 'HP' },
];
const COLUMNS: TableColumn<Row>[] = [{ key: 'name', header: 'Name' }];
const ACTIONS: RowAction<Row>[] = [{ id: 'edit', label: 'Edit', icon: 'pi pi-pencil' }];

function fakeAuth(keys: string[]) {
  const grantedKeys = signal(new Set(keys));
  return {
    grantedKeys,
    can: (key: string) => grantedKeys().has(key),
    isAuthenticated: signal(true),
  };
}

function setup(keys: string[], inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({
    imports: [
      ListPageComponent,
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [{ provide: AuthStore, useValue: fakeAuth(keys) }],
  });
  const fixture = TestBed.createComponent(ListPageComponent<Row>);
  const base: Record<string, unknown> = {
    title: 'Brands',
    addLabel: 'Add brand',
    addPermission: 'products.brand.create',
    rows: ROWS,
    columns: COLUMNS,
    total: ROWS.length,
    query: { ...DEFAULT_TABLE_QUERY },
    actions: ACTIONS,
    ...inputs,
  };
  for (const [name, value] of Object.entries(base)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const buttonByText = (el: HTMLElement, text: string) =>
  Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

describe('ListPage', () => {
  it('shows the title and the rows', () => {
    const { el } = setup([]);
    expect(el.querySelector('h1')?.textContent).toContain('Brands');
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('Dell');
    expect(body).toContain('HP');
  });

  it('hides the add button without permission', () => {
    const { el } = setup([]);
    expect(buttonByText(el, 'Add brand')).toBeUndefined();
  });

  it('shows the add button with permission and emits add', () => {
    const { fixture, el } = setup(['products.brand.create']);
    const spy = vi.fn();
    fixture.componentInstance.add.subscribe(spy);
    buttonByText(el, 'Add brand')?.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('shows the add button for everyone when no permission is given', () => {
    const { el } = setup([], { addPermission: null });
    expect(buttonByText(el, 'Add brand')).toBeDefined();
  });

  it('has no add button when addLabel is empty', () => {
    const { el } = setup(['products.brand.create'], { addLabel: '' });
    expect(buttonByText(el, 'Add brand')).toBeUndefined();
  });

  it('shows the action error', () => {
    const { el } = setup([], { actionError: 'This record is in use.' });
    expect(el.querySelector('p[role="alert"]')?.textContent).toContain('in use');
  });

  it('forwards row actions', () => {
    const { fixture, el } = setup([]);
    const events: RowActionEvent<Row>[] = [];
    fixture.componentInstance.action.subscribe((e) => events.push(e));
    el.querySelector<HTMLButtonElement>('tbody button')?.click();
    expect(events).toEqual([{ actionId: 'edit', row: ROWS[0] }]);
  });
});