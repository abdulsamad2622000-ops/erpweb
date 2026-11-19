import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { Paged } from '../../products/services/products.service';
import {
  LabelItem,
  LabelTemplate,
  LabelTemplateInput,
  PrintLogEntry,
  PrintLogInput,
} from '../models/barcode.models';

function queryString(q: Partial<TableQuery>): string {
  const qs = new URLSearchParams();
  qs.set('page', String(q.page ?? 1));
  qs.set('pageSize', String(q.pageSize ?? 10));
  if (q.search) qs.set('search', q.search);
  if (q.sort) qs.set('sort', `${q.sort.field}:${q.sort.direction}`);
  for (const [k, v] of Object.entries(q.filters ?? {})) if (v) qs.set(k, v);
  return qs.toString();
}

@Injectable({ providedIn: 'root' })
export class LabelsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/labels`;

  /** SKU, serial aur bin jin ka label ban sakta hai. filters.kind = sku | serial | bin */
  items(q: Partial<TableQuery>): Observable<Paged<LabelItem>> {
    return this.http.get<Paged<LabelItem>>(`${this.base}/items?${queryString(q)}`);
  }

  /** Scan ki hui value (serial, SKU ya bin) se item. Na mile to 404. */
  lookup(value: string): Observable<LabelItem> {
    return this.http.get<LabelItem>(`${this.base}/lookup?value=${encodeURIComponent(value)}`);
  }

  templates(): Observable<LabelTemplate[]> {
    return this.http.get<LabelTemplate[]>(`${this.base}/templates`);
  }
  createTemplate(body: LabelTemplateInput): Observable<LabelTemplate> {
    return this.http.post<LabelTemplate>(`${this.base}/templates`, body);
  }
  updateTemplate(id: number, body: LabelTemplateInput): Observable<LabelTemplate> {
    return this.http.put<LabelTemplate>(`${this.base}/templates/${id}`, body);
  }
  deleteTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/templates/${id}`);
  }

  printLog(q: Partial<TableQuery>): Observable<Paged<PrintLogEntry>> {
    return this.http.get<Paged<PrintLogEntry>>(`${this.base}/print-log?${queryString(q)}`);
  }
  /** Print se pehle record. Backend reprint par reason aur permission check karta hai. */
  logPrint(body: PrintLogInput): Observable<PrintLogEntry> {
    return this.http.post<PrintLogEntry>(`${this.base}/print-log`, body);
  }
}
