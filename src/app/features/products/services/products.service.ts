import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { Brand, BrandInput, Category, CategoryInput, Product, ProductInput } from '../models';

export interface Paged<T> {
  data: T[];
  total: number;
}

export abstract class CrudApi<T extends { id: number }, I> {
  protected readonly http = inject(HttpClient);
  protected abstract readonly path: string;

  private get base(): string {
    return `${APP_CONFIG.apiBase}/${this.path}`;
  }

  list(q: Partial<TableQuery> = {}): Observable<Paged<T>> {
    // Query string URL mein hi banate hain, taake mock interceptor (req.url) ko search/sort/paging dikhe
    const qs = new URLSearchParams();
    qs.set('page', String(q.page ?? 1));
    qs.set('pageSize', String(q.pageSize ?? 10));
    if (q.search) qs.set('search', q.search);
    if (q.sort) qs.set('sort', `${q.sort.field}:${q.sort.direction}`);
    for (const [k, v] of Object.entries(q.filters ?? {})) {
      if (v) qs.set(k, String(v));
    }
    return this.http.get<Paged<T>>(`${this.base}?${qs.toString()}`);
  }

  get(id: number): Observable<T> {
    return this.http.get<T>(`${this.base}/${id}`);
  }

  create(body: I): Observable<T> {
    return this.http.post<T>(this.base, body);
  }

  update(id: number, body: I): Observable<T> {
    return this.http.put<T>(`${this.base}/${id}`, body);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ProductsService extends CrudApi<Product, ProductInput> {
  protected readonly path = 'products';
}

@Injectable({ providedIn: 'root' })
export class BrandsService extends CrudApi<Brand, BrandInput> {
  protected readonly path = 'brands';
}

@Injectable({ providedIn: 'root' })
export class CategoriesService extends CrudApi<Category, CategoryInput> {
  protected readonly path = 'categories';
}
