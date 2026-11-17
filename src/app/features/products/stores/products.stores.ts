import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { DEFAULT_TABLE_QUERY, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { Brand, BrandInput, Category, CategoryInput, Product, ProductInput } from '../models';
import { BrandsService, CategoriesService, Paged, ProductsService } from '../services/products.service';

interface CrudApiLike<T, I> {
  list(q: Partial<TableQuery>): Observable<Paged<T>>;
  create(body: I): Observable<T>;
  update(id: number, body: I): Observable<T>;
  remove(id: number): Observable<void>;
}

function messageOf(e: unknown): string {
  const err = e as { error?: { message?: string } };
  return err.error?.message ?? 'Something went wrong.';
}

abstract class CrudStore<T extends { id: number }, I> {
  protected abstract readonly api: CrudApiLike<T, I>;

  readonly rows = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly query = signal<TableQuery>({ ...DEFAULT_TABLE_QUERY });

  async load(patch: Partial<TableQuery> = {}): Promise<void> {
    const q = { ...this.query(), ...patch };
    this.query.set(q);
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.list(q));
      this.rows.set(res.data);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }

  /** Kamyabi par null, warna error message (page dikhayega) */
  async save(id: number | null, body: I): Promise<string | null> {
    try {
      await firstValueFrom(id === null ? this.api.create(body) : this.api.update(id, body));
      await this.load();
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }

  /** Kamyabi par null, warna error message (409 par "in use" ka message) */
  async remove(id: number): Promise<string | null> {
    try {
      await firstValueFrom(this.api.remove(id));
      await this.load();
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }
}

@Injectable({ providedIn: 'root' })
export class ProductsStore extends CrudStore<Product, ProductInput> {
  protected readonly api = inject(ProductsService);
}

@Injectable({ providedIn: 'root' })
export class BrandsStore extends CrudStore<Brand, BrandInput> {
  protected readonly api = inject(BrandsService);
}

@Injectable({ providedIn: 'root' })
export class CategoriesStore extends CrudStore<Category, CategoryInput> {
  protected readonly api = inject(CategoriesService);
}
