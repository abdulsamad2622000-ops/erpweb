import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { DEFAULT_TABLE_QUERY, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { Role, RoleBody, RoleListItem } from '../models/roles.models';

function messageOf(e: unknown): string {
  const m = (e as HttpErrorResponse | null)?.error?.message;
  return typeof m === 'string' ? m : 'Something went wrong.';
}

@Injectable({ providedIn: 'root' })
export class RolesStore {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  readonly rows = signal<RoleListItem[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly query = signal<TableQuery>({ ...DEFAULT_TABLE_QUERY });

  /** Error par throw karta hai (page loadError dikhata hai). */
  async load(q: TableQuery = this.query()): Promise<void> {
    this.query.set(q);
    this.loading.set(true);
    try {
      const p = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
      if (q.search) p.set('search', q.search);
      if (q.sort) p.set('sort', `${q.sort.field}:${q.sort.direction}`);
      const res = await firstValueFrom(
        this.http.get<{ data: RoleListItem[]; total: number }>(`${this.base}/roles?${p.toString()}`),
      );
      this.rows.set(res.data);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }

  get(id: number): Promise<Role> {
    return firstValueFrom(this.http.get<Role>(`${this.base}/roles/${id}`));
  }

  /** Kamyabi par null, warna error message. */
  async save(id: number | null, body: RoleBody): Promise<string | null> {
    try {
      await firstValueFrom(
        id === null
          ? this.http.post(`${this.base}/roles`, body)
          : this.http.put(`${this.base}/roles/${id}`, body),
      );
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }

  async remove(id: number): Promise<string | null> {
    try {
      await firstValueFrom(this.http.delete(`${this.base}/roles/${id}`));
      await this.load();
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }
}
