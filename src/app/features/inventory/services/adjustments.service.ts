import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { AdjustmentAction, AdjustmentInput, StockAdjustment } from '../models/adjustment.models';

@Injectable({ providedIn: 'root' })
export class AdjustmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/inventory/adjustments`;

  list(): Observable<StockAdjustment[]> {
    return this.http.get<StockAdjustment[]>(this.base);
  }
  get(id: number): Observable<StockAdjustment> {
    return this.http.get<StockAdjustment>(`${this.base}/${id}`);
  }
  create(body: AdjustmentInput): Observable<StockAdjustment> {
    return this.http.post<StockAdjustment>(this.base, body);
  }
  /** approve | reject. reject mein note (wajah) zaroori hai. */
  action(id: number, action: AdjustmentAction, body: { note?: string | null } = {}): Observable<StockAdjustment> {
    return this.http.post<StockAdjustment>(`${this.base}/${id}/${action}`, body);
  }
}