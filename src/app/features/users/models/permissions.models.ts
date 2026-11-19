export type OverrideMode = 'default' | 'allow' | 'deny';

export interface OverridesBody {
  allow: string[];
  deny: string[];
}

export interface UserPermissions extends OverridesBody {
  userId: number;
  userName: string;
  roleName: string | null;
  rolePermissions: string[];
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}
