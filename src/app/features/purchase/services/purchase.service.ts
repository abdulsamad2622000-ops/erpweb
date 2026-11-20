import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { Grn, PoInput, PurchaseOrder, SerialCheck, Supplier, SupplierInput } from '../models/purchase.models';

export interface Paged<T> {
  data: T[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/purchase`;

  suppliers(search = ''): Observable<Paged<Supplier>> {
    return this.http.get<Paged<Supplier>>(`${this.base}/suppliers?pageSize=500&search=${encodeURIComponent(search)}`);
  }
  createSupplier(b: SupplierInput): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.base}/suppliers`, b);
  }
  updateSupplier(id: number, b: SupplierInput): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.base}/suppliers/${id}`, b);
  }

  orders(): Observable<PurchaseOrder[]> {
    return this.http.get<PurchaseOrder[]>(`${this.base}/orders`);
  }
  order(id: number): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${this.base}/orders/${id}`);
  }
  createOrder(b: PoInput): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/orders`, b);
  }
  updateOrder(id: number, b: PoInput): Observable<PurchaseOrder> {
    return this.http.put<PurchaseOrder>(`${this.base}/orders/${id}`, b);
  }
  /** action: submit | approve | reject | cancel */
  orderAction(id: number, action: string, note: string | null = null): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/orders/${id}/${action}`, { note });
  }

  grns(): Observable<Grn[]> {
    return this.http.get<Grn[]>(`${this.base}/grns`);
  }
  grn(id: number): Observable<Grn> {
    return this.http.get<Grn>(`${this.base}/grns/${id}`);
  }
  /** PO se nayi draft GRN (sirf baqi qty ke sath). */
  createGrn(poId: number): Observable<Grn> {
    return this.http.post<Grn>(`${this.base}/grns`, { poId });
  }
  saveGrn(id: number, lines: Grn['lines']): Observable<Grn> {
    return this.http.put<Grn>(`${this.base}/grns/${id}`, { lines });
  }
  postGrn(id: number, lines: Grn['lines']): Observable<Grn> {
    return this.http.post<Grn>(`${this.base}/grns/${id}/post`, { lines });
  }
  checkSerial(serial: string, productId: number): Observable<SerialCheck> {
    return this.http.post<SerialCheck>(`${this.base}/serials/check`, { serial, productId });
  }
}
