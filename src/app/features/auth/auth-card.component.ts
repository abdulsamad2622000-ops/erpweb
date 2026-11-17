import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-auth-card',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative flex min-h-screen items-center justify-center bg-page p-4">
      <div class="absolute end-4 top-4 flex gap-2">
        <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-text hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent"
          [attr.aria-label]="'common.theme' | transloco" (click)="theme.toggle()">
          <i [class]="theme.theme() === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"></i>
        </button>
      </div>
      <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div class="mb-6 flex items-center gap-2 text-lg font-semibold text-text">
          <i class="pi pi-box text-accent" aria-hidden="true"></i>
          <span>{{ 'app.name' | transloco }}</span>
        </div>
        <h1 class="text-2xl font-semibold text-text">{{ heading() }}</h1>
        @if (subtitle()) {
          <p class="mt-1 text-sm text-muted">{{ subtitle() }}</p>
        }
        <div class="mt-6"><ng-content /></div>
      </div>
    </div>
  `,
})
export class AuthCardComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>('');
  readonly theme = inject(ThemeService);
}