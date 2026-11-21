import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { ListQuery, Paged, qs } from '../../sales/services/sales.service';
import { EmailLog, EmailSettings, EmailTemplate, SendResult } from '../models/email.models';

@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  templates(): Observable<EmailSettings> {
    return this.http.get<EmailSettings>(`${this.base}/email/templates`);
  }
  save(t: Pick<EmailTemplate, 'key' | 'subject' | 'body' | 'isActive'>): Observable<EmailTemplate> {
    return this.http.put<EmailTemplate>(`${this.base}/email/templates/${t.key}`, { subject: t.subject, body: t.body, isActive: t.isActive });
  }
  test(key: string, to: string): Observable<SendResult> {
    return this.http.post<SendResult>(`${this.base}/email/templates/${key}/test`, { to });
  }
  logs(q: ListQuery = {}): Observable<Paged<EmailLog>> {
    return this.http.get<Paged<EmailLog>>(`${this.base}/email/logs${qs(q)}`);
  }
  sendInvoice(id: number, to: string | null): Observable<SendResult> {
    return this.http.post<SendResult>(`${this.base}/sales/invoices/${id}/email`, to ? { to } : {});
  }
  sendStatement(customerId: number, to: string | null): Observable<SendResult> {
    return this.http.post<SendResult>(`${this.base}/customers/${customerId}/statement-email`, to ? { to } : {});
  }
  sendRepairReady(jobId: number, to: string | null): Observable<SendResult> {
    return this.http.post<SendResult>(`${this.base}/warranty/jobs/${jobId}/email`, to ? { to } : {});
  }
}
