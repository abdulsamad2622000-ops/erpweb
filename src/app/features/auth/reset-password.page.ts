import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthCardComponent } from './auth-card.component';

@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, TranslocoPipe, AuthCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [heading]="'auth.resetTitle' | transloco" [subtitle]="linkOk ? ('auth.resetHelp' | transloco) : ''">
      @if (!linkOk) {
        <p role="alert" class="rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {{ 'auth.resetInvalidLink' | transloco }}
        </p>
      } @else if (done()) {
        <p role="status" class="rounded-[10px] border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {{ 'auth.resetDone' | transloco }}
        </p>
      } @else {
        <form class="space-y-4" novalidate (submit)="onSubmit($event)">
          @if (errorKey(); as k) {
            <p role="alert" class="rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ k | transloco }}</p>
          }
          <div>
            <label for="password" class="mb-1 block text-sm font-medium text-text">{{ 'auth.newPassword' | transloco }}</label>
            <input placeholder="Enter password..." id="password" type="password" dir="ltr" autocomplete="new-password"
              class="h-11 w-full rounded-[10px] border border-input bg-card px-3 text-text focus-visible:outline-2 focus-visible:outline-accent"
              [value]="password()" (input)="password.set(value($event))"
              [attr.aria-invalid]="submitted() && !passwordValid()" aria-describedby="password-err" />
            @if (submitted() && !passwordValid()) {
              <p id="password-err" class="mt-1 text-sm text-danger">{{ 'auth.passwordShort' | transloco }}</p>
            }
          </div>
          <div>
            <label for="confirm" class="mb-1 block text-sm font-medium text-text">{{ 'auth.confirmPassword' | transloco }}</label>
            <input placeholder="Enter confirm..." id="confirm" type="password" dir="ltr" autocomplete="new-password"
              class="h-11 w-full rounded-[10px] border border-input bg-card px-3 text-text focus-visible:outline-2 focus-visible:outline-accent"
              [value]="confirm()" (input)="confirm.set(value($event))"
              [attr.aria-invalid]="submitted() && !matches()" aria-describedby="confirm-err" />
            @if (submitted() && !matches()) {
              <p id="confirm-err" class="mt-1 text-sm text-danger">{{ 'auth.passwordMismatch' | transloco }}</p>
            }
          </div>
          <button type="submit" [disabled]="loading()"
            class="h-12 w-full rounded-[10px] bg-accent font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
            {{ 'auth.resetSave' | transloco }}
          </button>
        </form>
      }
      <a routerLink="/login" class="mt-4 inline-block text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">{{ 'auth.backToLogin' | transloco }}</a>
    </app-auth-card>
  `,
})
export class ResetPasswordPage {
  private readonly auth = inject(AuthService);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  private readonly token = this.params.get('token') ?? '';
  private readonly email = this.params.get('email') ?? '';
  readonly linkOk = this.token.length > 0 && this.email.length > 0;

  readonly password = signal('');
  readonly confirm = signal('');
  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly errorKey = signal<string | null>(null);

  // Minimum 10 characters frontend ka andaza hai; asli rules backend tay karega
  readonly passwordValid = computed(() => this.password().length >= 10);
  readonly matches = computed(() => this.password() === this.confirm() && this.confirm().length > 0);

  value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this.submitted.set(true);
    this.errorKey.set(null);
    if (!this.passwordValid() || !this.matches() || this.loading()) return;

    this.loading.set(true);
    try {
      await firstValueFrom(
        this.auth.resetPassword({
          token: this.token,
          email: this.email,
          password: this.password(),
          password_confirmation: this.confirm(),
        }),
      );
      this.done.set(true);
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : -1;
      this.errorKey.set(
        status === 422 ? 'auth.resetInvalidLink' : status === 429 ? 'auth.throttled' : status === 0 ? 'errors.network' : 'errors.generic',
      );
    } finally {
      this.loading.set(false);
    }
  }
}