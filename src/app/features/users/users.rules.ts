import { UserType } from '../../core/auth/auth.models';

type Actor = UserType | null | undefined;

/** SuperAdmin sab ko, Admin sirf Staff ko manage karta hai. Staff kisi ko nahi. */
export function canManageUser(actor: Actor, target: UserType): boolean {
  if (actor === 'super_admin') return true;
  if (actor === 'admin') return target === 'staff';
  return false;
}

/** Naya user kis type ka banaya ja sakta hai. Sirf SuperAdmin Admin bana sakta hai. */
export function creatableTypes(actor: Actor): UserType[] {
  if (actor === 'super_admin') return ['admin', 'staff'];
  if (actor === 'admin') return ['staff'];
  return [];
}
