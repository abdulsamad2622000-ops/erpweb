import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthCardComponent } from './auth-card.component';

type Step = 'email' | 'code' | 'reset' | 'done';

const FIELD =
  'h-11 w-full rounded-[10px] border border-input bg-card px-3 text-text focus-visible:outline-2 focus-visible:outline-accent';
const BTN =
  'h-12 w-full rounded-[10px] bg-accent font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60';
const ERR = 'rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, TranslocoPipe, AuthCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [heading]="headingKey() | transloco" [subtitle]="subtitle()">
      @if (errorKey(); as k) {
        <p role="alert" class="mb-4 ${ERR}">{{ k | transloco }}</p>
      }

      @switch (step()) {
        @case ('email') {
          <form class="space-y-4" novalidate (submit)="onEmail($event)">
            <div>
              <label for="email" class="mb-1 block text-sm font-medium text-text">{{ 'auth.email' | transloco }}</label>
              <input id="email" type="email" dir="ltr" autocomplete="email" inputmode="email" class="${FIELD}"
                [value]="email()" (input)="email.set(value($event))"
                [attr.aria-invalid]="submitted() && !emailValid()" aria-describedby="email-err" />
              @if (submitted() && !emailValid()) {
                <p id="email-err" class="mt-1 text-sm text-danger">{{ 'auth.emailInvalid' | transloco }}</p>
              }
            </div>
            <button type="submit" [disabled]="loading()" class="${BTN}">{{ 'auth.fpSendCode' | transloco }}</button>
          </form>
        }
        @case ('code') {
          <form class="space-y-4" novalidate (submit)="onCode($event)">
            <div>
              <label for="code" class="mb-1 block text-sm font-medium text-text">{{ 'auth.code' | transloco }}</label>
              <input id="code" dir="ltr" inputmode="numeric" maxlength="6" autocomplete="one-time-code"
                class="h-12 w-full rounded-[10px] border border-input bg-card px-3 text-center text-xl tracking-[0.5em] text-text focus-visible:outline-2 focus-visible:outline-accent"
                [value]="code()" (input)="code.set(digits($event))"
                [attr.aria-invalid]="submitted() && !codeValid()" aria-describedby="code-err" />
              @if (submitted() && !codeValid()) {
                <p id="code-err" class="mt-1 text-sm text-danger">{{ 'auth.codeFormat' | transloco }}</p>
              }
            </div>
            <button type="submit" [disabled]="loading()" class="${BTN}">
              {{ (loading() ? 'auth.verifying' : 'auth.verify') | transloco }}
            </button>
            <button type="button" (click)="resend()" [disabled]="resendIn() > 0 || loading()"
              class="h-11 w-full rounded-[10px] border border-input text-sm font-medium text-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
              {{ (resendIn() > 0 ? 'auth.resendIn' : 'auth.resend') | transloco: { seconds: resendIn() } }}
            </button>
            <button type="button" (click)="changeEmail()"
              class="text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
              {{ 'auth.fpChangeEmail' | transloco }}
            </button>
          </form>
        }
        @case ('reset') {
          <form class="space-y-4" novalidate (submit)="onReset($event)">
            <div>
              <label for="password" class="mb-1 block text-sm font-medium text-text">{{ 'auth.newPassword' | transloco }}</label>
              <div class="relative">
                <input id="password" dir="ltr" autocomplete="new-password" [type]="showPw() ? 'text' : 'password'"
                  class="h-11 w-full rounded-[10px] border border-input bg-card ps-3 pe-12 text-text focus-visible:outline-2 focus-visible:outline-accent"
                  [value]="password()" (input)="password.set(value($event))"
                  [attr.aria-invalid]="submitted() && !passwordValid()" aria-describedby="password-err" />
                <button type="button"
                  class="absolute inset-y-0 end-0 inline-flex w-11 items-center justify-center rounded-[10px] text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
                  [attr.aria-label]="(showPw() ? 'auth.hidePassword' : 'auth.showPassword') | transloco"
                  (click)="showPw.set(!showPw())">
                  <i [class]="showPw() ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i>
                </button>
              </div>
              @if (submitted() && !passwordValid()) {
                <p id="password-err" class="mt-1 text-sm text-danger">{{ 'auth.passwordShort' | transloco }}</p>
              }
            </div>
            <div>
              <label for="confirm" class="mb-1 block text-sm font-medium text-text">{{ 'auth.confirmPassword' | transloco }}</label>
              <input id="confirm" dir="ltr" autocomplete="new-password" [type]="showPw() ? 'text' : 'password'" class="${FIELD}"
                [value]="confirm()" (input)="confirm.set(value($event))"
                [attr.aria-invalid]="submitted() && !matches()" aria-describedby="confirm-err" />
              @if (submitted() && !matches()) {
                <p id="confirm-err" class="mt-1 text-sm text-danger">{{ 'auth.passwordMismatch' | transloco }}</p>
              }
            </div>
            <button type="submit" [disabled]="loading()" class="${BTN}">{{ 'auth.resetSave' | transloco }}</button>
          </form>
        }
        @case ('done') {
          <p role="status" class="rounded-[10px] border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            {{ 'auth.resetDone' | transloco }}
          </p>
        }
      }
      <a routerLink="/login" class="mt-4 inline-block text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">{{ 'auth.backToLogin' | transloco }}</a>
    </app-auth-card>
  `,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);
  private token = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly step = signal<Step>('email');
  readonly email = signal('');
  readonly code = signal('');
  readonly password = signal('');
  readonly confirm = signal('');
  readonly showPw = signal(false);
  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly resendIn = signal(0);

  readonly emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()));
  readonly codeValid = computed(() => /^\d{6}$/.test(this.code()));
  readonly passwordValid = computed(() => this.password().length >= 10);
  readonly matches = computed(() => this.password() === this.confirm() && this.confirm().length > 0);

  readonly headingKey = computed(() => {
    switch (this.step()) {
      case 'code': return 'auth.fpCodeTitle';
      case 'reset': return 'auth.fpNewTitle';
      case 'done': return 'auth.fpDoneTitle';
      default: return 'auth.forgotTitle';
    }
  });
  readonly subtitle = computed(() => {
    switch (this.step()) {
      case 'email': return 'Enter your work email. We will send a 6-digit code to it.';
      case 'code': return `We sent a 6-digit code to ${this.email().trim()}.`;
      case 'reset': return 'Choose a new password (at least 10 characters).';
      default: return '';
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
  digits(e: Event): string {
    return (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
  }

  private startCountdown(seconds: number): void {
    this.stopTimer();
    this.resendIn.set(seconds);
    this.timer = setInterval(() => {
      const next = Math.max(this.resendIn() - 1, 0);
      this.resendIn.set(next);
      if (next === 0) this.stopTimer();
    }, 1000);
  }
  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private errorFor(err: unknown, fallback: string): string {
    const status = err instanceof HttpErrorResponse ? err.status : -1;
    if (status === 429) return 'auth.throttled';
    if (status === 0) return 'errors.network';
    if (status === 401 || status === 422) return fallback;
    return 'errors.generic';
  }

  private begin(): void {
    this.submitted.set(true);
    this.errorKey.set(null);
  }

  async onEmail(e: Event): Promise<void> {
    e.preventDefault();
    this.begin();
    if (!this.emailValid() || this.loading()) return;
    this.loading.set(true);
    try {
      await firstValueFrom(this.auth.forgotPassword(this.email().trim()));
      this.code.set('');
      this.submitted.set(false);
      this.step.set('code');
      this.startCountdown(60);
    } catch (err) {
      this.errorKey.set(this.errorFor(err, 'errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  async resend(): Promise<void> {
    if (this.resendIn() > 0 || this.loading()) return;
    this.errorKey.set(null);
    this.loading.set(true);
    try {
      await firstValueFrom(this.auth.forgotPassword(this.email().trim()));
      this.startCountdown(60);
    } catch (err) {
      this.errorKey.set(this.errorFor(err, 'errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  changeEmail(): void {
    this.stopTimer();
    this.errorKey.set(null);
    this.submitted.set(false);
    this.code.set('');
    this.step.set('email');
  }

  async onCode(e: Event): Promise<void> {
    e.preventDefault();
    this.begin();
    if (!this.codeValid() || this.loading()) return;
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.auth.verifyResetCode(this.email().trim(), this.code()));
      this.token = res.token;
      this.stopTimer();
      this.submitted.set(false);
      this.step.set('reset');
    } catch (err) {
      this.errorKey.set(this.errorFor(err, 'auth.fpCodeInvalid'));
      this.code.set('');
      this.submitted.set(false);
      document.getElementById('code')?.focus();
    } finally {
      this.loading.set(false);
    }
  }

  async onReset(e: Event): Promise<void> {
    e.preventDefault();
    this.begin();
    if (!this.passwordValid() || !this.matches() || this.loading()) return;
    this.loading.set(true);
    try {
      await firstValueFrom(
        this.auth.resetPassword({
          token: this.token,
          email: this.email().trim(),
          password: this.password(),
          password_confirmation: this.confirm(),
        }),
      );
      this.password.set('');
      this.confirm.set('');
      this.step.set('done');
    } catch (err) {
      this.errorKey.set(this.errorFor(err, 'auth.resetInvalidLink'));
    } finally {
      this.loading.set(false);
    }
  }
}