import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { qs } from '../../sales/services/sales.service';
import { Dashboard, PurchaseReport, RepairReport, SalesGroup, SalesReport, StockReport } from '../models/report.models';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  dashboard(): Observable<Dashboard> {
    return this.http.get<Dashboard>(`${this.base}/dashboard`);
  }
  sales(from: string, to: string, groupBy: SalesGroup): Observable<SalesReport> {
    return this.http.get<SalesReport>(`${this.base}/reports/sales${qs({ from, to, groupBy })}`);
  }
  stock(warehouseId?: number | null): Observable<StockReport> {
    return this.http.get<StockReport>(`${this.base}/reports/stock${qs({ warehouseId })}`);
  }
  purchases(from: string, to: string): Observable<PurchaseReport> {
    return this.http.get<PurchaseReport>(`${this.base}/reports/purchases${qs({ from, to })}`);
  }
  repairs(from: string, to: string): Observable<RepairReport> {
    return this.http.get<RepairReport>(`${this.base}/reports/repairs${qs({ from, to })}`);
  }
}
