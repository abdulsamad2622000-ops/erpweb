import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { DEFAULT_TABLE_QUERY, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { AuditEntry, OverridesBody, UserPermissions } from '../models/permissions.models';

function messageOf(e: unknown): string {
  const m = (e as HttpErrorResponse | null)?.error?.message;
  return typeof m === 'string' ? m : 'Something went wrong.';
}

@Injectable({ providedIn: 'root' })
export class UserPermissionsStore {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  /** Error par throw karta hai (page loadError dikhata hai). */
  get(userId: number): Promise<UserPermissions> {
    return firstValueFrom(this.http.get<UserPermissions>(`${this.base}/users/${userId}/permissions`));
  }

  /** Kamyabi par null, warna error message. */
  async save(userId: number, body: OverridesBody): Promise<string | null> {
    try {
      await firstValueFrom(this.http.put(`${this.base}/users/${userId}/permissions`, body));
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }
}

@Injectable({ providedIn: 'root' })
export class AuditStore {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  readonly rows = signal<AuditEntry[]>([]);
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
        this.http.get<{ data: AuditEntry[]; total: number }>(`${this.base}/audit?${p.toString()}`),
      );
      this.rows.set(res.data);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }
}
