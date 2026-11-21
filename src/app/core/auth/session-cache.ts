import { AuthUser, Branch, PermissionGrant, UserLimits } from './auth.models';

/**
 * Aakhri kamyab /me ka nakshaa. Offline refresh par (/me ka status 0) isi se user login rehta hai.
 * Sirf UI ke liye: asli enforcement backend karta hai. Logout ya 401 par saaf ho jata hai.
 */
export interface SessionSnapshot {
  user: AuthUser;
  permissions: PermissionGrant[];
  branches: Branch[];
  activeBranchId: number | null;
  limits: UserLimits | null;
  savedAt: number;
}

const KEY = 'erp.session';
/** Itne din se purana nakshaa offline bhi qabool nahi. */
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function saveSession(s: Omit<SessionSnapshot, 'savedAt'>, now = Date.now()): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: now }));
  } catch {
    // Storage nahi to offline refresh par dobara login karna parega.
  }
}

export function readSession(now = Date.now()): SessionSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SessionSnapshot> | null;
    if (!v || typeof v !== 'object' || !v.user || !Array.isArray(v.permissions) || typeof v.savedAt !== 'number') return null;
    if (now - v.savedAt > SESSION_MAX_AGE_MS) return null;
    return {
      user: v.user,
      permissions: v.permissions,
      branches: Array.isArray(v.branches) ? v.branches : [],
      activeBranchId: v.activeBranchId ?? null,
      limits: v.limits ?? null,
      savedAt: v.savedAt,
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // koi baat nahi
  }
}