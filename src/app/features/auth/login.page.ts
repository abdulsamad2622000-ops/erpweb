import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
      [subtitle]="(step() === 'code' ? 'auth.codeHelp' : 'auth.subtitle') | transloco">

      @if (errorKey(); as k) {
        <p role="alert" class="mb-4 rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {{ k | transloco }}
        </p>
      }

      @if (step() === 'credentials') {
        <form class="space-y-4" novalidate (submit)="onSubmit($event)">
          <div>
            <label for="email" class="mb-1 block text-sm font-medium text-text">{{ 'auth.email' | transloco }}</label>
            <input id="email" type="email" dir="ltr" autocomplete="username" inputmode="email"
              class="h-11 w-full rounded-[10px] border border-border bg-card px-3 text-text focus-visible:outline-2 focus-visible:outline-accent"
              [value]="email()" (input)="email.set(value($event))"
              [attr.aria-invalid]="submitted() && !emailValid()" aria-describedby="email-err" />
            @if (submitted() && !emailValid()) {
              <p id="email-err" class="mt-1 text-sm text-danger">{{ 'auth.emailInvalid' | transloco }}</p>
            }
          </div>

          <div>
            <label for="password" class="mb-1 block text-sm font-medium text-text">{{ 'auth.password' | transloco }}</label>
            <div class="relative">
              <input id="password" dir="ltr" autocomplete="current-password"
                [type]="showPassword() ? 'text' : 'password'"
                class="h-11 w-full rounded-[10px] border border-border bg-card ps-3 pe-12 text-text focus-visible:outline-2 focus-visible:outline-accent"
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
            {{ (loading() ? 'auth.signingIn' : 'auth.signIn') | transloco }}
          </button>

          <div class="flex flex-col gap-2 text-sm">
            <a routerLink="/forgot-password" class="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">{{ 'auth.forgot' | transloco }}</a>
            <a routerLink="/recover-email" class="text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">{{ 'auth.forgotEmail' | transloco }}</a>
          </div>
        </form>
      } @else {
        <form class="space-y-4" novalidate (submit)="onCode($event)">
          <div>
            <label for="code" class="mb-1 block text-sm font-medium text-text">{{ 'auth.code' | transloco }}</label>
            <input id="code" dir="ltr" inputmode="numeric" maxlength="6" autocomplete="one-time-code"
              class="h-12 w-full rounded-[10px] border border-border bg-card px-3 text-center text-xl tracking-[0.5em] text-text focus-visible:outline-2 focus-visible:outline-accent"
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