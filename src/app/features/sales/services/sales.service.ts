import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { ReturnInput, ReturnResult } from '../../pos/models/pos.models';
import {
  Challan, ChallanInput, CustomerForm, DocInput, Invoice, PaymentInput, PriceInfo, Quotation, SalesOrder, WholesaleCustomer,
} from '../models/sales.models';

export interface Paged<T> {
  data: T[];
  total: number;
}

export type ListQuery = Record<string, string | number | boolean | null | undefined>;

/** Query string URL mein hi (mock interceptor bhi isi se parhta hai). */
export function qs(q: ListQuery = {}): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  const t = p.toString();
  return t ? `?${t}` : '';
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly http = inject(HttpClient);
  private readonly api = APP_CONFIG.apiBase;
  private readonly base = `${APP_CONFIG.apiBase}/sales`;

  customers(q: ListQuery = {}): Observable<WholesaleCustomer[]> {
    return this.http.get<WholesaleCustomer[]>(`${this.api}/customers${qs(q)}`);
  }
  customer(id: number): Observable<WholesaleCustomer> {
    return this.http.get<WholesaleCustomer>(`${this.api}/customers/${id}`);
  }
  saveCustomer(body: CustomerForm, id?: number): Observable<WholesaleCustomer> {
    return id
      ? this.http.put<WholesaleCustomer>(`${this.api}/customers/${id}`, body)
      : this.http.post<WholesaleCustomer>(`${this.api}/customers`, body);
  }

  price(customerId: number, productId: number): Observable<PriceInfo> {
    return this.http.get<PriceInfo>(`${this.base}/price${qs({ customerId, productId })}`);
  }

  quotations(q: ListQuery = {}): Observable<Paged<Quotation>> {
    return this.http.get<Paged<Quotation>>(`${this.base}/quotations${qs(q)}`);
  }
  quotation(id: number): Observable<Quotation> {
    return this.http.get<Quotation>(`${this.base}/quotations/${id}`);
  }
  saveQuotation(body: DocInput, id?: number): Observable<Quotation> {
    return id
      ? this.http.put<Quotation>(`${this.base}/quotations/${id}`, body)
      : this.http.post<Quotation>(`${this.base}/quotations`, body);
  }
  quotationAction(id: number, action: 'send' | 'cancel'): Observable<Quotation> {
    return this.http.post<Quotation>(`${this.base}/quotations/${id}/${action}`, {});
  }
  convert(id: number): Observable<{ quotation: Quotation; order: SalesOrder }> {
    return this.http.post<{ quotation: Quotation; order: SalesOrder }>(`${this.base}/quotations/${id}/convert`, {});
  }

  orders(q: ListQuery = {}): Observable<Paged<SalesOrder>> {
    return this.http.get<Paged<SalesOrder>>(`${this.base}/orders${qs(q)}`);
  }
  order(id: number): Observable<SalesOrder> {
    return this.http.get<SalesOrder>(`${this.base}/orders/${id}`);
  }
  createOrder(body: DocInput): Observable<SalesOrder> {
    return this.http.post<SalesOrder>(`${this.base}/orders`, body);
  }
  cancelOrder(id: number): Observable<SalesOrder> {
    return this.http.post<SalesOrder>(`${this.base}/orders/${id}/cancel`, {});
  }

  challans(q: ListQuery = {}): Observable<Paged<Challan>> {
    return this.http.get<Paged<Challan>>(`${this.base}/challans${qs(q)}`);
  }
  challan(id: number): Observable<Challan> {
    return this.http.get<Challan>(`${this.base}/challans/${id}`);
  }
  createChallan(body: ChallanInput, key: string): Observable<Challan> {
    return this.http.post<Challan>(`${this.base}/challans`, body, { headers: { 'Idempotency-Key': key } });
  }

  invoices(q: ListQuery = {}): Observable<Paged<Invoice>> {
    return this.http.get<Paged<Invoice>>(`${this.base}/invoices${qs(q)}`);
  }
  invoice(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/invoices/${id}`);
  }
  createInvoice(challanId: number, payments: PaymentInput[], key: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/invoices`, { challanId, payments }, { headers: { 'Idempotency-Key': key } });
  }
  receivePayment(id: number, body: PaymentInput, key: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/invoices/${id}/payments`, body, { headers: { 'Idempotency-Key': key } });
  }
  returnItems(body: ReturnInput): Observable<ReturnResult> {
    return this.http.post<ReturnResult>(`${APP_CONFIG.apiBase}/pos/returns`, body);
  }
}
