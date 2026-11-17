import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { Brand, BrandInput, Category, CategoryInput, Product, ProductInput } from '../models';

export interface Paged<T> {
  data: T[];
  total: number;
}

abstract class CrudApi<T extends { id: number }, I> {
  protected readonly http = inject(HttpClient);
  protected abstract readonly path: string;

  private get base(): string {
    return `${APP_CONFIG.apiBase}/${this.path}`;
  }

  list(q: Partial<TableQuery> = {}): Observable<Paged<T>> {
    let params = new HttpParams()
      .set('page', q.page ?? 1)
      .set('pageSize', q.pageSize ?? 10);
    if (q.search) params = params.set('search', q.search);
    if (q.sort) params = params.set('sort', `${q.sort.field}:${q.sort.direction}`);
    for (const [k, v] of Object.entries(q.filters ?? {})) {
      if (v) params = params.set(k, v);
    }
    return this.http.get<Paged<T>>(this.base, { params });
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
