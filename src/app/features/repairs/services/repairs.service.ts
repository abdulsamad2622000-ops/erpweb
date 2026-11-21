import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { PayMethod } from '../../pos/models/pos.models';
import { ListQuery, Paged, qs } from '../../sales/services/sales.service';
import { JobInput, JobStatus, JobUpdate, RepairJob, WarrantyCheck } from '../models/repair.models';

@Injectable({ providedIn: 'root' })
export class RepairsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/warranty`;

  check(serial: string): Observable<WarrantyCheck> {
    return this.http.get<WarrantyCheck>(`${this.base}/check/${encodeURIComponent(serial.trim())}`);
  }
  list(q: ListQuery = {}): Observable<Paged<RepairJob>> {
    return this.http.get<Paged<RepairJob>>(`${this.base}/jobs${qs(q)}`);
  }
  get(id: number): Observable<RepairJob> {
    return this.http.get<RepairJob>(`${this.base}/jobs/${id}`);
  }
  create(body: JobInput, key: string): Observable<RepairJob> {
    return this.http.post<RepairJob>(`${this.base}/jobs`, body, { headers: { 'Idempotency-Key': key } });
  }
  update(id: number, body: JobUpdate): Observable<RepairJob> {
    return this.http.put<RepairJob>(`${this.base}/jobs/${id}`, body);
  }
  move(id: number, status: JobStatus, note: string | null): Observable<RepairJob> {
    return this.http.post<RepairJob>(`${this.base}/jobs/${id}/status`, { status, note });
  }
  deliver(id: number, amount: number, method: PayMethod | null, key: string): Observable<RepairJob> {
    return this.http.post<RepairJob>(`${this.base}/jobs/${id}/deliver`, { amount, method }, { headers: { 'Idempotency-Key': key } });
  }
}
