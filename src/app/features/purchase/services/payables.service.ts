import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import {
  BillInput, LandedCost, LandedCostItem, PaymentInput, PoMatching, PurchaseReturn, PurchaseReturnInput,
  ReturnableSerial, SupplierBill, SupplierLedger, SupplierPayment,
} from '../models/payables.models';

@Injectable({ providedIn: 'root' })
export class PayablesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/purchase`;

  ledger(supplierId: number): Observable<SupplierLedger> {
    return this.http.get<SupplierLedger>(`${this.base}/suppliers/${supplierId}/ledger`);
  }

  payments(supplierId: number | null = null): Observable<SupplierPayment[]> {
    const qs = supplierId === null ? '' : `?supplierId=${supplierId}`;
    return this.http.get<SupplierPayment[]>(`${this.base}/payments${qs}`);
  }
  createPayment(body: PaymentInput): Observable<SupplierPayment> {
    return this.http.post<SupplierPayment>(`${this.base}/payments`, body);
  }

  landedCost(grnId: number): Observable<LandedCost> {
    return this.http.get<LandedCost>(`${this.base}/grns/${grnId}/landed-cost`);
  }
  saveLandedCost(grnId: number, items: LandedCostItem[]): Observable<LandedCost> {
    return this.http.put<LandedCost>(`${this.base}/grns/${grnId}/landed-cost`, { items });
  }

  matching(poId: number): Observable<PoMatching> {
    return this.http.get<PoMatching>(`${this.base}/orders/${poId}/matching`);
  }
  saveBill(poId: number, body: BillInput): Observable<SupplierBill> {
    return this.http.post<SupplierBill>(`${this.base}/orders/${poId}/bill`, body);
  }

  returns(): Observable<PurchaseReturn[]> {
    return this.http.get<PurchaseReturn[]>(`${this.base}/returns`);
  }
  /** Scan kiye serial ki detail: kis GRN aur supplier ka hai, wapas ho sakta hai ya nahi. */
  returnable(serial: string): Observable<ReturnableSerial> {
    return this.http.get<ReturnableSerial>(`${this.base}/returns/serial/${encodeURIComponent(serial)}`);
  }
  createReturn(body: PurchaseReturnInput): Observable<PurchaseReturn> {
    return this.http.post<PurchaseReturn>(`${this.base}/returns`, body);
  }
}