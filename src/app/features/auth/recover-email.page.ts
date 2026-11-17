import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthCardComponent } from './auth-card.component';

@Component({
  selector: 'app-recover-email',
  imports: [RouterLink, TranslocoPipe, AuthCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-auth-card [heading]="'auth.recoverTitle' | transloco" [subtitle]="'auth.recoverHelp' | transloco">
      @if (done()) {
        <p role="status" class="rounded-[10px] border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          {{ 'auth.recoverDone' | transloco }}
        </p>
      } @else {
        <form class="space-y-4" novalidate (submit)="onSubmit($event)">
          @if (errorKey(); as k) {
            <p role="alert" class="rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ k | transloco }}</p>
          }
          <div>
            <label for="phone" class="mb-1 block text-sm font-medium text-text">{{ 'auth.phone' | transloco }}</label>
            <input id="phone" type="tel" dir="ltr" autocomplete="tel" inputmode="tel" placeholder="+92300..."
              class="h-11 w-full rounded-[10px] border border-border bg-card px-3 text-text focus-visible:outline-2 focus-visible:outline-accent"
              [value]="phone()" (input)="phone.set(value($event))"
              [attr.aria-invalid]="submitted() && !phoneValid()" aria-describedby="phone-err" />
            @if (submitted() && !phoneValid()) {
              <p id="phone-err" class="mt-1 text-sm text-danger">{{ 'auth.phoneInvalid' | transloco }}</p>
            }
          </div>
          <button type="submit" [disabled]="loading()"
            class="h-12 w-full rounded-[10px] bg-accent font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
            {{ 'auth.sendSms' | transloco }}
          </button>
        </form>
      }
      <a routerLink="/login" class="mt-4 inline-block text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">{{ 'auth.backToLogin' | transloco }}</a>
    </app-auth-card>
  `,
})
export class RecoverEmailPage {
  private readonly auth = inject(AuthService);

  readonly phone = signal('');
  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly done = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly phoneValid = computed(() => /^\+[0-9]{10,15}$/.test(this.phone().replace(/[\s-]/g, '')));

  value(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this.submitted.set(true);
    this.errorKey.set(null);
    if (!this.phoneValid() || this.loading()) return;

    this.loading.set(true);
    try {
      await firstValueFrom(this.auth.recoverEmail(this.phone().replace(/[\s-]/g, '')));
      this.done.set(true);
    } catch (err) {
      const status = err instanceof HttpErrorResponse ? err.status : -1;
      this.errorKey.set(status === 429 ? 'auth.throttled' : status === 0 ? 'errors.network' : 'errors.generic');
    } finally {
      this.loading.set(false);
    }
  }
}