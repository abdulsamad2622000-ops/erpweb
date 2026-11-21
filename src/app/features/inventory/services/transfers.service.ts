import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { Transfer, TransferAction, TransferInput } from '../models/transfer.models';

@Injectable({ providedIn: 'root' })
export class TransfersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/inventory/transfers`;

  list(): Observable<Transfer[]> {
    return this.http.get<Transfer[]>(this.base);
  }
  get(id: number): Observable<Transfer> {
    return this.http.get<Transfer>(`${this.base}/${id}`);
  }
  create(body: TransferInput): Observable<Transfer> {
    return this.http.post<Transfer>(this.base, body);
  }
  /** approve | reject | dispatch | receive | cancel. body: { note?, serials? } */
  action(id: number, action: TransferAction, body: { note?: string | null; serials?: string[] } = {}): Observable<Transfer> {
    return this.http.post<Transfer>(`${this.base}/${id}/${action}`, body);
  }
}