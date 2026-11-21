import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import {
  CartLine, Customer, CustomerInput, HeldBill, PosItem, PosSearchResult, PosShift, ReturnInput, ReturnResult, Sale,
  SaleInput, ShiftState,
} from '../models/pos.models';

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/pos`;

  shift(): Observable<ShiftState> {
    return this.http.get<ShiftState>(`${this.base}/shift`);
  }

  openShift(warehouseId: number, openingCash: number): Observable<PosShift> {
    return this.http.post<PosShift>(`${this.base}/shift/open`, { warehouseId, openingCash });
  }

  closeShift(countedCash: number, note: string | null): Observable<PosShift> {
    return this.http.post<PosShift>(`${this.base}/shift/close`, { countedCash, note });
  }

  scan(code: string): Observable<PosItem> {
    return this.http.get<PosItem>(`${this.base}/scan/${encodeURIComponent(code.trim())}`);
  }

  search(q: string): Observable<PosSearchResult[]> {
    return this.http.get<PosSearchResult[]>(`${this.base}/search`, { params: new HttpParams().set('search', q) });
  }

  complete(body: SaleInput): Observable<Sale> {
    return this.http.post<Sale>(`${this.base}/sales`, body);
  }

  sale(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${this.base}/sales/${id}`);
  }

  findSale(code: string): Observable<Sale> {
    return this.http.get<Sale>(`${this.base}/sales/find/${encodeURIComponent(code.trim())}`);
  }

  holds(): Observable<HeldBill[]> {
    return this.http.get<HeldBill[]>(`${this.base}/holds`);
  }

  hold(label: string, payload: { lines: CartLine[]; customer: Customer | null; discount: number }): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.base}/holds`, { label, payload });
  }

  dropHold(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/holds/${id}`);
  }

  returnItems(body: ReturnInput): Observable<ReturnResult> {
    return this.http.post<ReturnResult>(`${this.base}/returns`, body);
  }

  customers(search: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${APP_CONFIG.apiBase}/customers`, { params: new HttpParams().set('search', search) });
  }

  addCustomer(body: CustomerInput): Observable<Customer> {
    return this.http.post<Customer>(`${APP_CONFIG.apiBase}/customers`, body);
  }
}
