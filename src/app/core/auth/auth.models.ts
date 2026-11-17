export type UserType = 'super_admin' | 'admin' | 'staff';

export interface AuthUser {
  id: number;
  name: string;
  role: string;
  isSuperAdmin: boolean;
  type?: UserType;
}

export interface PermissionGrant {
  key: string;
  scope: string;
  expiresAt: string | null;
  limit: number | null;
}

export interface Branch {
  id: number;
  name: string;
}

export interface UserLimits {
  discountPercent: number | null;
  adjustmentUnits: number | null;
  maxSaleWithoutApproval: number | null;
}

export interface MeResponse {
  user: AuthUser;
  permissions: PermissionGrant[];
  branches?: Branch[];
  activeBranchId?: number | null;
  limits?: UserLimits | null;
  locale?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  twoFactorRequired: boolean;
}

export interface ResetPasswordRequest {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}