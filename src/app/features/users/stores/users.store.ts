import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { DEFAULT_TABLE_QUERY, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { ManagedUser, RoleOption, UserBody } from '../models/users.models';

function messageOf(e: unknown): string {
  const m = (e as HttpErrorResponse | null)?.error?.message;
  return typeof m === 'string' ? m : 'Something went wrong.';
}

@Injectable({ providedIn: 'root' })
export class UsersStore {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  readonly rows = signal<ManagedUser[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly query = signal<TableQuery>({ ...DEFAULT_TABLE_QUERY });
  readonly roles = signal<RoleOption[]>([]);

  /** Error par throw karta hai (page loadError dikhata hai). */
  async load(q: TableQuery = this.query()): Promise<void> {
    this.query.set(q);
    this.loading.set(true);
    try {
      const p = new URLSearchParams({ page: String(q.page), pageSize: String(q.pageSize) });
      if (q.search) p.set('search', q.search);
      if (q.sort) p.set('sort', `${q.sort.field}:${q.sort.direction}`);
      for (const [k, v] of Object.entries(q.filters)) if (v) p.set(k, v);
      const res = await firstValueFrom(
        this.http.get<{ data: ManagedUser[]; total: number }>(`${this.base}/users?${p.toString()}`),
      );
      this.rows.set(res.data);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }

  async loadRoles(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: RoleOption[] }>(`${this.base}/roles?pageSize=100`),
      );
      this.roles.set(res.data);
    } catch {
      this.roles.set([]);
    }
  }

  /** Kamyabi par null, warna error message. */
  async save(id: number | null, body: UserBody): Promise<string | null> {
    return this.mutate(() =>
      id === null
        ? this.http.post(`${this.base}/users`, body)
        : this.http.put(`${this.base}/users/${id}`, body),
    );
  }

  remove(id: number): Promise<string | null> {
    return this.mutate(() => this.http.delete(`${this.base}/users/${id}`));
  }

  setActive(id: number, isActive: boolean): Promise<string | null> {
    return this.mutate(() => this.http.post(`${this.base}/users/${id}/active`, { isActive }));
  }

  async forceLogout(id: number): Promise<string | null> {
    return this.mutate(() => this.http.post(`${this.base}/users/${id}/force-logout`, {}), false);
  }

  async resetPassword(id: number): Promise<string | null> {
    return this.mutate(() => this.http.post(`${this.base}/users/${id}/reset-password`, {}), false);
  }

  private async mutate(call: () => ReturnType<HttpClient['post']>, reload = true): Promise<string | null> {
    try {
      await firstValueFrom(call());
      if (reload) await this.load();
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }
}
