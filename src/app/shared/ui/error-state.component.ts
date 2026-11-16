import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-error-state',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="alert" class="flex flex-col items-center rounded-xl border border-border bg-card p-10 text-center">
      <i class="pi pi-exclamation-triangle text-4xl text-danger" aria-hidden="true"></i>
      <h2 class="mt-3 text-lg font-semibold text-text">{{ title() || ('state.error' | transloco) }}</h2>
      <p class="mt-1 text-sm text-muted">{{ hint() || ('state.errorHint' | transloco) }}</p>
      <button type="button" class="mt-4 inline-flex h-12 items-center rounded-[10px] bg-accent px-6 text-white focus-visible:outline-2 focus-visible:outline-accent"
        (click)="retry.emit()">{{ 'state.retry' | transloco }}</button>
    </div>
  `,
})
export class ErrorStateComponent {
  readonly title = input('');
  readonly hint = input('');
  readonly retry = output<void>();
}