import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { ListQuery, Paged, qs } from '../../sales/services/sales.service';
import { EmailLog, EmailSettings, EmailTemplate, EmailTrigger, ScheduledReport, SendResult, SmtpInput, SmtpSettings } from '../models/email.models';

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
  smtp(): Observable<SmtpSettings> {
    return this.http.get<SmtpSettings>(`${this.base}/email/smtp`);
  }
  saveSmtp(b: SmtpInput): Observable<SmtpSettings> {
    return this.http.put<SmtpSettings>(`${this.base}/email/smtp`, b);
  }
  testSmtp(to: string): Observable<SendResult> {
    return this.http.post<SendResult>(`${this.base}/email/smtp/test`, { to });
  }
  triggers(): Observable<EmailTrigger[]> {
    return this.http.get<EmailTrigger[]>(`${this.base}/email/triggers`);
  }
  saveTriggers(b: EmailTrigger[]): Observable<EmailTrigger[]> {
    return this.http.put<EmailTrigger[]>(`${this.base}/email/triggers`, b);
  }
  schedules(): Observable<ScheduledReport[]> {
    return this.http.get<ScheduledReport[]>(`${this.base}/email/schedules`);
  }
  saveSchedules(b: ScheduledReport[]): Observable<ScheduledReport[]> {
    return this.http.put<ScheduledReport[]>(`${this.base}/email/schedules`, b);
  }
  resend(logId: number): Observable<SendResult> {
    return this.http.post<SendResult>(`${this.base}/email/logs/${logId}/resend`, {});
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
