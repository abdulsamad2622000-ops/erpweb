import { Observable, firstValueFrom } from 'rxjs';
import { TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { Paged } from '../../products/services/products.service';

/** Saare pages ek ek karke laata hai (bade list mein bhi kuch na chhute). */
export async function loadAll<T>(api: { list(q: Partial<TableQuery>): Observable<Paged<T>> }): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await firstValueFrom(api.list({ page, pageSize: 200 }));
    all.push(...res.data);
    if (res.data.length === 0 || all.length >= res.total) break;
  }
  return all;
}