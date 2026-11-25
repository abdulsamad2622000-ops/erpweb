import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { ListQuery, Paged, qs } from '../../sales/services/sales.service';
import { CashBook, Expense, ExpenseCategory, ExpenseInput, ProfitReport } from '../models/accounts.models';

@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/accounts`;

  categories(): Observable<ExpenseCategory[]> {
    return this.http.get<ExpenseCategory[]>(`${this.base}/expense-categories`);
  }
  addCategory(name: string): Observable<ExpenseCategory> {
    return this.http.post<ExpenseCategory>(`${this.base}/expense-categories`, { name });
  }
  expenses(q: ListQuery = {}): Observable<Paged<Expense> & { sum: number }> {
    return this.http.get<Paged<Expense> & { sum: number }>(`${this.base}/expenses${qs(q)}`);
  }
  save(body: ExpenseInput, id: number | null, key: string): Observable<Expense> {
    return id
      ? this.http.put<Expense>(`${this.base}/expenses/${id}`, body)
      : this.http.post<Expense>(`${this.base}/expenses`, body, { headers: { 'Idempotency-Key': key } });
  }
  void(id: number, reason: string): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/expenses/${id}/void`, { reason });
  }
  cashbook(from: string, to: string, method: string): Observable<CashBook> {
    return this.http.get<CashBook>(`${this.base}/cashbook${qs({ from, to, method })}`);
  }
  profit(from: string, to: string): Observable<ProfitReport> {
    return this.http.get<ProfitReport>(`${APP_CONFIG.apiBase}/reports/profit${qs({ from, to })}`);
  }
}
