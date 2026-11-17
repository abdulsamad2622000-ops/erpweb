import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AuthUser, LoginRequest, PermissionGrant } from './auth.models';
import { AuthService } from './auth.service';

export type AuthStatus = 'unknown' | 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: AuthUser | null;
  permissions: PermissionGrant[];
  status: AuthStatus;
}

const initialState: AuthState = { user: null, permissions: [], status: 'unknown' };

function isActive(p: PermissionGrant): boolean {
  return p.expiresAt === null || Date.parse(p.expiresAt) > Date.now();
}

// UI sirf hide/show ke liye. Asli enforcement backend karta hai.
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ status, permissions }) => ({
    isAuthenticated: computed(() => status() === 'authenticated'),
    grantedKeys: computed(() => new Set(permissions().filter(isActive).map((p) => p.key))),
  })),
  withMethods((store, auth = inject(AuthService)) => {
    const load = async (): Promise<void> => {
      patchState(store, { status: 'loading' });
      try {
        const me = await firstValueFrom(auth.me());
        patchState(store, { user: me.user, permissions: me.permissions, status: 'authenticated' });
      } catch {
        patchState(store, { ...initialState, status: 'anonymous' });
      }
    };

    return {
      load,
      can(key: string): boolean {
        return store.grantedKeys().has(key);
      },
      async login(body: LoginRequest): Promise<boolean> {
        await firstValueFrom(auth.login(body));
        await load();
        return store.status() === 'authenticated';
      },
      async logout(): Promise<void> {
        try {
          await firstValueFrom(auth.logout());
        } finally {
          patchState(store, { ...initialState, status: 'anonymous' });
        }
      },
    };
  }),
);