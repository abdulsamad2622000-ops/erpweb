import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore, LoginOutcome } from '../../core/auth/auth.store';
import { safeReturnUrl } from '../../core/auth/return-url';
import { AuthCardComponent } from './auth-card.component';

type Step = 'credentials' | 'code';

@Component({
  selector: 'app-login',
  imports: [RouterLink, TranslocoPipe, AuthCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card
      [heading]="(step() === 'code' ? 'auth.codeTitle' : 'auth.title') | transloco"
      [subtitle]="step() === 'code' ? ('auth.codeSentTo' | transloco: { email: masked() }) : ('auth.subtitle' | transloco)">

      @if (errorKey(); as k) {
        <p role="alert" class="mb-4 rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {{ k | transloco }}
        </p>
      }

      @if (step() === 'credentials') {
        <form class="space-y-4" novalidate (submit)="onSubmit($event)">
          <div>
            <label for="email" class="mb-2 flex items-center gap-2 text-sm font-medium text-text"><i class="pi pi-envelope text-[#8FB0FF]" aria-hidden="true"></i>{{ 'auth.email' | transloco }}</label>
            <input id="email" type="email" dir="ltr" autocomplete="username" inputmode="email" placeholder="Enter your email address..."
              class="h-11 w-full rounded-[10px] border border-input bg-card px-3 text-text focus-visible:outline-2 focus-visible:outline-accent"
              [value]="email()" (input)="email.set(value($event))"
              [attr.aria-invalid]="submitted() && !emailValid()" aria-describedby="email-err" />
            @if (submitted() && !emailValid()) {
              <p id="email-err" class="mt-1 text-sm text-danger">{{ 'auth.emailInvalid' | transloco }}</p>
            }
          </div>

          <div>
            <label for="password" class="mb-2 flex items-center gap-2 text-sm font-medium text-text"><i class="pi pi-lock text-[#8FB0FF]" aria-hidden="true"></i>{{ 'auth.password' | transloco }}</label>
            <div class="relative">
              <input id="password" dir="ltr" autocomplete="current-password" placeholder="Enter your password..."
                [type]="showPassword() ? 'text' : 'password'"
                class="h-11 w-full rounded-[10px] border border-input bg-card ps-3 pe-12 text-text focus-visible:outline-2 focus-visible:outline-accent"
                [value]="password()" (input)="password.set(value($event))"
                [attr.aria-invalid]="submitted() && !passwordValid()" aria-describedby="password-err" />
              <button type="button"
                class="absolute inset-y-0 end-0 inline-flex w-11 items-center justify-center rounded-[10px] text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-accent"
                [attr.aria-label]="(showPassword() ? 'auth.hidePassword' : 'auth.showPassword') | transloco"
                (click)="showPassword.set(!showPassword())">
                <i [class]="showPassword() ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i>
              </button>
            </div>
            @if (submitted() && !passwordValid()) {
              <p id="password-err" class="mt-1 text-sm text-danger">{{ 'auth.passwordRequired' | transloco }}</p>
            }
          </div>

          <button type="submit" [disabled]="loading()"
            class="h-12 w-full rounded-[10px] bg-accent font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
            <span class="inline-flex items-center justify-center gap-2"><i class="pi pi-sign-in" aria-hidden="true"></i>{{ (loading() ? 'auth.signingIn' : 'auth.signIn') | transloco }}</span>
          </button>

          <div class="flex flex-col items-center gap-3 text-sm"><div class="flex w-full items-center gap-3 text-xs text-muted"><span class="h-px flex-1 bg-[var(--auth-line)]"></span>or<span class="h-px flex-1 bg-[var(--auth-line)]"></span></div>
            <a routerLink="/forgot-password" class="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent"><i class="pi pi-lock me-2 text-xs" aria-hidden="true"></i>{{ 'auth.forgot' | transloco }}</a>
          </div>
        </form>
      } @else {
        <form class="space-y-4" novalidate (submit)="onCode($event)">
          <div>
            <label for="code" class="mb-1 block text-sm font-medium text-text">{{ 'auth.code' | transloco }}</label>
            <input placeholder="Enter code..." id="code" dir="ltr" inputmode="numeric" maxlength="6" autocomplete="one-time-code"
              class="h-12 w-full rounded-[10px] border border-input bg-card px-3 text-center text-xl tracking-[0.5em] text-text focus-visible:outline-2 focus-visible:outline-accent"
              [value]="code()" (input)="code.set(digits($event))"
              [attr.aria-invalid]="submitted() && !codeValid()" aria-describedby="code-err" />
            @if (submitted() && !codeValid()) {
              <p id="code-err" class="mt-1 text-sm text-danger">{{ 'auth.codeFormat' | transloco }}</p>
            }
          </div>
          <button type="submit" [disabled]="loading()"
            class="h-12 w-full rounded-[10px] bg-accent font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
            {{ (loading() ? 'auth.verifying' : 'auth.verify') | transloco }}
          </button>
          <button type="button" (click)="resend()" [disabled]="resendIn() > 0 || resending()"
            class="h-11 w-full rounded-[10px] border border-input text-sm font-medium text-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
            {{ (resendIn() > 0 ? 'auth.resendIn' : 'auth.resend') | transloco: { seconds: resendIn() } }}
          </button>
          <button type="button" (click)="backToCredentials()"
            class="text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">
            {{ 'auth.backToCredentials' | transloco }}
          </button>
        </form>
      }
    </app-auth-card>
  `,
})
export class LoginPage {
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly step = signal<Step>('credentials');
  readonly email = signal('');
  readonly password = signal('');
  readonly code = signal('');
  readonly showPassword = signal(false);
  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly errorKey = signal<string | null>(null);

  readonly masked = computed(() => this.store.challenge()?.maskedEmail ?? '');
  readonly resendIn = signal(0);
  readonly resending = signal(false);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
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

  async resend(): Promise<void> {
    if (this.resendIn() > 0 || this.resending()) return;
    this.resending.set(true);
    this.errorKey.set(null);
    try {
      this.startCountdown(await this.store.resendTwoFactor());
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : -1;
      if (status === 401) {
        this.backToCredentials();
        this.errorKey.set('errors.csrf');
      } else {
        this.errorKey.set(this.mapError(err, 'errors.generic'));
      }
    } finally {
      this.resending.set(false);
    }
  }

  readonly emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()));
  readonly passwordValid = computed(() => this.password().length > 0);
  readonly codeValid = computed(() => /^\d{6}$/.test(this.code()));

  value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  digits(e: Event): string {
    return (e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
  }

  backToCredentials(): void {
    this.stopTimer();
    this.step.set('credentials');
    this.code.set('');
    this.submitted.set(false);
    this.errorKey.set(null);
    this.password.set('');
  }

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this.submitted.set(true);
    this.errorKey.set(null);
    if (!this.emailValid() || !this.passwordValid() || this.loading()) return;

    this.loading.set(true);
    try {
      const res = await this.store.login({ email: this.email().trim(), password: this.password() });
      await this.handle(res, true);
    } catch (err) {
      this.errorKey.set(this.mapError(err, 'auth.invalid'));
    } finally {
      this.loading.set(false);
    }
  }

  async onCode(e: Event): Promise<void> {
    e.preventDefault();
    this.submitted.set(true);
    this.errorKey.set(null);
    if (!this.codeValid() || this.loading()) return;

    this.loading.set(true);
    try {
      const res = await this.store.verifyTwoFactor(this.code());
      await this.handle(res, false);
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : -1;
      if (status === 401) {
        // login ka waqt ghatam ho gaya, dobara shuru
        this.backToCredentials();
        this.errorKey.set('errors.csrf');
      } else {
        this.errorKey.set(this.mapError(err, 'auth.codeInvalid'));
        this.code.set('');
        this.submitted.set(false);
        document.getElementById('code')?.focus();
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async handle(res: LoginOutcome, fromCredentials: boolean): Promise<void> {
    if (res === 'authenticated') {
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    } else if (res === 'two_factor') {
      this.submitted.set(false);
      this.step.set('code');
      this.startCountdown(this.store.challenge()?.resendAfterSeconds ?? 60);
    } else {
      this.errorKey.set(fromCredentials ? 'auth.invalid' : 'auth.codeInvalid');
    }
  }

  private mapError(err: unknown, invalidKey: string): string {
    const status = err instanceof HttpErrorResponse ? err.status : -1;
    if (status === 429) return 'auth.throttled';
    if (status === 0) return 'errors.network';
    if (status === 401 || status === 422) return invalidKey;
    return 'errors.generic';
  }
}