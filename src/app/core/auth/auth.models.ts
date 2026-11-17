export interface AuthUser {
  id: number;
  name: string;
  role: string;
  isSuperAdmin: boolean;
}

export interface PermissionGrant {
  key: string;
  scope: string;
  expiresAt: string | null;
  limit: number | null;
}

export interface MeResponse {
  user: AuthUser;
  permissions: PermissionGrant[];
}

export interface LoginRequest {
  email: string;
  password: string;
}