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
