import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { CountAction, CountInput, StockCount } from '../models/count.models';

@Injectable({ providedIn: 'root' })
export class CountsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/inventory/counts`;

  list(): Observable<StockCount[]> {
    return this.http.get<StockCount[]>(this.base);
  }
  get(id: number): Observable<StockCount> {
    return this.http.get<StockCount>(`${this.base}/${id}`);
  }
  create(body: CountInput): Observable<StockCount> {
    return this.http.post<StockCount>(this.base, body);
  }
  /** submit | approve | reject. body: { note?, serials? } */
  action(id: number, action: CountAction, body: { note?: string | null; serials?: string[] } = {}): Observable<StockCount> {
    return this.http.post<StockCount>(`${this.base}/${id}/${action}`, body);
  }
}