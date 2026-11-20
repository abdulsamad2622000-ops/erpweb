import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import {
  LabelItem, LabelKind, LabelTemplate, LabelTemplateInput, PrintLogEntry, PrintLogInput,
} from '../models/label.models';

@Injectable({ providedIn: 'root' })
export class LabelsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/labels`;

  templates(): Observable<LabelTemplate[]> {
    return this.http.get<LabelTemplate[]>(`${this.base}/templates`);
  }

  createTemplate(body: LabelTemplateInput): Observable<LabelTemplate> {
    return this.http.post<LabelTemplate>(`${this.base}/templates`, body);
  }

  updateTemplate(id: number, body: LabelTemplateInput): Observable<LabelTemplate> {
    return this.http.put<LabelTemplate>(`${this.base}/templates/${id}`, body);
  }

  items(kind: LabelKind, q = '', grn = ''): Observable<LabelItem[]> {
    // Query URL mein hi, taake mock interceptor (req.url) bhi dekh sake.
    const qs = new URLSearchParams({ kind, q, grn }).toString();
    return this.http.get<LabelItem[]>(`${this.base}/items?${qs}`);
  }

  /** Scan kiye gaye code se item (serial, SKU ya bin). */
  lookup(code: string): Observable<LabelItem> {
    return this.http.get<LabelItem>(`${this.base}/lookup/${encodeURIComponent(code)}`);
  }

  /** Jin GRNs ke serials label list mein hain. */
  grns(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/grns`);
  }

  log(): Observable<PrintLogEntry[]> {
    return this.http.get<PrintLogEntry[]>(`${this.base}/print-log`);
  }

  record(body: PrintLogInput): Observable<PrintLogEntry> {
    return this.http.post<PrintLogEntry>(`${this.base}/print-log`, body);
  }
}
