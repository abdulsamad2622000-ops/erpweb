import { UserType } from '../../../core/auth/auth.models';

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  type: UserType;
  roleId: number | null;
  roleName: string | null;
  branchIds: number[];
  isActive: boolean;
  /** Temporary access: is date ke baad login band. null = koi expiry nahi. */
  accessExpiresAt: string | null;
  discountPercent: number | null;
  adjustmentUnits: number | null;
}

export type UserBody = Omit<ManagedUser, 'id' | 'roleName'>;

export interface RoleOption {
  id: number;
  name: string;
}
