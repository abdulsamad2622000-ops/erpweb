import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthCardComponent } from './auth-card.component';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, TranslocoPipe, AuthCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [heading]="'auth.forgotTitle' | transloco" [subtitle]="'auth.forgotHelp' | transloco">
      @if (done()) {
        <p role="status" class="rounded-[10px] border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {{ 'auth.forgotDone' | transloco }}
        </p>
      } @else {
        <form class="space-y-4" novalidate (submit)="onSubmit($event)">
          @if (errorKey(); as k) {
            <p role="alert" class="rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ k | transloco }}</p>
          }
          <div>
            <label for="email" class="mb-1 block text-sm font-medium text-text">{{ 'auth.email' | transloco }}</label>
            <input id="email" type="email" dir="ltr" autocomplete="email" inputmode="email"
              class="h-11 w-full rounded-[10px] border border-input bg-card px-3 text-text focus-visible:outline-2 focus-visible:outline-accent"
              [value]="email()" (input)="email.set(value($event))"
              [attr.aria-invalid]="submitted() && !emailValid()" aria-describedby="email-err" />
            @if (submitted() && !emailValid()) {
              <p id="email-err" class="mt-1 text-sm text-danger">{{ 'auth.emailInvalid' | transloco }}</p>
            }
          </div>
          <button type="submit" [disabled]="loading()"
            class="h-12 w-full rounded-[10px] bg-accent font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
            {{ 'auth.sendLink' | transloco }}
          </button>
        </form>
      }
      <a routerLink="/login" class="mt-4 inline-block text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">{{ 'auth.backToLogin' | transloco }}</a>
    </app-auth-card>
  `,
})
export class ForgotPasswordPage {
  private readonly auth = inject(AuthService);

  readonly email = signal('');
  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()));

  value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this.submitted.set(true);
    this.errorKey.set(null);
    if (!this.emailValid() || this.loading()) return;

    this.loading.set(true);
    try {
      await firstValueFrom(this.auth.forgotPassword(this.email().trim()));
      this.done.set(true);
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : -1;
      this.errorKey.set(status === 429 ? 'auth.throttled' : status === 0 ? 'errors.network' : 'errors.generic');
    } finally {
      this.loading.set(false);
    }
  }
}