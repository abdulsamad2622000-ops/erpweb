import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-empty-state',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <i [class]="icon()" class="text-4xl text-muted" aria-hidden="true"></i>
      <h2 class="mt-3 text-lg font-semibold text-text">{{ title() || ('state.empty' | transloco) }}</h2>
      <p class="mt-1 text-sm text-muted">{{ hint() || ('state.emptyHint' | transloco) }}</p>
      <div class="mt-4"><ng-content /></div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('pi pi-inbox');
  readonly title = input('');
  readonly hint = input('');
}