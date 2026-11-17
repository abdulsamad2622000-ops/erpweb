import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AuthUser,
  Branch,
  LoginRequest,
  PermissionGrant,
  TwoFactorChallenge,
  UserLimits,
} from './auth.models';
import { AuthService } from './auth.service';

export type AuthStatus = 'unknown' | 'loading' | 'authenticated' | 'anonymous';
export type LoginOutcome = 'authenticated' | 'two_factor' | 'failed';

interface AuthState {
  user: AuthUser | null;
  permissions: PermissionGrant[];
  branches: Branch[];
  activeBranchId: number | null;
  limits: UserLimits | null;
  challenge: TwoFactorChallenge | null;
  status: AuthStatus;
}

const initialState: AuthState = {
  user: null,
  permissions: [],
  branches: [],
  activeBranchId: null,
  limits: null,
  challenge: null,
  status: 'unknown',
};

const BRANCH_KEY = 'erp.branch'; // sirf branch id (UI preference), koi secret nahi
const DEFAULT_RESEND_SECONDS = 60;

function savedBranch(): number | null {
  try {
    const v = localStorage.getItem(BRANCH_KEY);
    const n = v === null ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function saveBranch(id: number): void {
  try {
    localStorage.setItem(BRANCH_KEY, String(id));
  } catch {
    // storage available nahi, choice sirf is session tak
  }
}

function isActive(p: PermissionGrant): boolean {
  return p.expiresAt === null || Date.parse(p.expiresAt) > Date.now();
}

// UI sirf hide/show ke liye. Asli enforcement backend karta hai.
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ status, permissions, branches, activeBranchId }) => ({
    isAuthenticated: computed(() => status() === 'authenticated'),
    grantedKeys: computed(() => new Set(permissions().filter(isActive).map((p) => p.key))),
    activeBranch: computed(() => branches().find((b) => b.id === activeBranchId()) ?? null),
  })),
  withMethods((store, auth = inject(AuthService)) => {
    let pending: Promise<void> | null = null;

    const load = async (): Promise<void> => {
      patchState(store, { status: 'loading' });
      try {
        const me = await firstValueFrom(auth.me());
        const branches = me.branches ?? [];
        const saved = savedBranch();
        const activeBranchId =
          saved !== null && branches.some((b) => b.id === saved)
            ? saved
            : (me.activeBranchId ?? branches[0]?.id ?? null);
        patchState(store, {
          user: me.user,
          permissions: me.permissions,
          branches,
          activeBranchId,
          limits: me.limits ?? null,
          challenge: null,
          status: 'authenticated',
        });
      } catch {
        patchState(store, { ...initialState, status: 'anonymous' });
      }
    };

    const outcome = (): LoginOutcome => (store.status() === 'authenticated' ? 'authenticated' : 'failed');

    return {
      load,
      /** Ek hi /me request, chahe kitne guards ek saath poochein */
      ensureLoaded(): Promise<void> {
        if (store.status() === 'authenticated' || store.status() === 'anonymous') {
          return Promise.resolve();
        }
        pending ??= load().finally(() => {
          pending = null;
        });
        return pending;
      },
      reset(): void {
        patchState(store, { ...initialState, status: 'anonymous' });
      },
      can(key: string): boolean {
        return store.grantedKeys().has(key);
      },
      setActiveBranch(id: number): void {
        if (store.branches().some((b) => b.id === id)) {
          patchState(store, { activeBranchId: id });
          saveBranch(id);
        }
      },
      async login(body: LoginRequest): Promise<LoginOutcome> {
        const res = await firstValueFrom(auth.login(body));
        if (res?.twoFactorRequired) {
          patchState(store, {
            challenge: {
              method: 'email',
              maskedEmail: res.maskedEmail ?? '',
              resendAfterSeconds: res.resendAfterSeconds ?? DEFAULT_RESEND_SECONDS,
            },
          });
          return 'two_factor';
        }
        await load();
        return outcome();
      },
      async verifyTwoFactor(code: string): Promise<LoginOutcome> {
        await firstValueFrom(auth.twoFactor(code));
        await load();
        return outcome();
      },
      /** Naya code bhejta hai, agle resend tak ke seconds wapas deta hai. */
      async resendTwoFactor(): Promise<number> {
        const res = await firstValueFrom(auth.resendTwoFactor());
        const challenge = store.challenge();
        if (challenge) patchState(store, { challenge: { ...challenge, resendAfterSeconds: res.resendAfterSeconds } });
        return res.resendAfterSeconds;
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