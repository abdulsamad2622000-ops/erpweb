import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { ListQuery, Paged, qs } from '../../sales/services/sales.service';
import { ClaimInput, ClaimStatus, PublicWarranty, SupplierClaim } from '../models/claim.models';

@Injectable({ providedIn: 'root' })
export class ClaimsService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  /** Bina login ke. Backend sirf product aur warranty ki tareekh de, customer ki detail nahi. */
  publicCheck(serial: string): Observable<PublicWarranty> {
    return this.http.get<PublicWarranty>(`${this.base}/public/warranty/${encodeURIComponent(serial.trim())}`);
  }
  list(q: ListQuery = {}): Observable<Paged<SupplierClaim>> {
    return this.http.get<Paged<SupplierClaim>>(`${this.base}/warranty/supplier-claims${qs(q)}`);
  }
  create(body: ClaimInput): Observable<SupplierClaim> {
    return this.http.post<SupplierClaim>(`${this.base}/warranty/supplier-claims`, body);
  }
  move(id: number, status: ClaimStatus, note: string | null): Observable<SupplierClaim> {
    return this.http.post<SupplierClaim>(`${this.base}/warranty/supplier-claims/${id}/status`, { status, note });
  }
}
