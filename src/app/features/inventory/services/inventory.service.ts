import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { SerialDetail, StockLedgerRow, StockSerial, StockStatus, StockSummaryRow } from '../models/inventory.models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/inventory`;

  stock(warehouseId: number | null = null): Observable<StockSummaryRow[]> {
    const qs = warehouseId ? `?warehouseId=${warehouseId}` : '';
    return this.http.get<StockSummaryRow[]>(`${this.base}/stock${qs}`);
  }

  serials(q = '', status: StockStatus | '' = ''): Observable<StockSerial[]> {
    const qs = new URLSearchParams({ q, status }).toString();
    return this.http.get<StockSerial[]>(`${this.base}/serials?${qs}`);
  }

  serial(serial: string): Observable<SerialDetail> {
    return this.http.get<SerialDetail>(`${this.base}/serials/${encodeURIComponent(serial)}`);
  }

  ledger(): Observable<StockLedgerRow[]> {
    return this.http.get<StockLedgerRow[]>(`${this.base}/ledger`);
  }
}