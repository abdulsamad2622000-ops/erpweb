export interface EmailTemplate {
  key: 'invoice' | 'statement' | 'repair_ready' | string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  variables: string[];
  updatedAt: string;
}

export interface EmailSettings {
  templates: EmailTemplate[];
  mailer: string;
  from: string;
}

export interface EmailLog {
  id: number;
  templateKey: string | null;
  to: string;
  subject: string;
  status: 'sent' | 'failed';
  error: string | null;
  ref: string | null;
  by: string;
  at: string;
}

export interface SendResult {
  status: 'sent';
  subject: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  encryption: 'tls' | 'ssl' | 'none';
  username: string;
  fromName: string;
  fromEmail: string;
  hasPassword: boolean;
}
export type SmtpInput = Omit<SmtpSettings, 'hasPassword'> & { password?: string };

export interface EmailTrigger {
  event: string;
  label: string;
  recipients: 'customer' | 'staff' | 'both';
  templateKey: string;
  enabled: boolean;
}

export interface ScheduledReport {
  id: number;
  report: 'sales' | 'stock' | 'receivables' | 'purchases';
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string;
  enabled: boolean;
}
