import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-xl border border-border bg-card p-8">
      <h1 class="text-2xl font-semibold text-text">{{ title() }}</h1>
      <p class="mt-2 text-muted">Coming in a later step.</p>
    </div>
  `,
})
export class PlaceholderPage {
  private readonly route = inject(ActivatedRoute);
  readonly title = computed(() => this.route.snapshot.data['title'] as string);
}