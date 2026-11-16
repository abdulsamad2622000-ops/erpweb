import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';

@Component({
  selector: 'app-placeholder',
  imports: [PageHeaderComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header [title]="'menu.' + key | transloco" />
    <div class="rounded-xl border border-border bg-card p-8 text-muted">
      {{ 'common.comingSoon' | transloco }}
    </div>
  `,
})
export class PlaceholderPage {
  readonly key = inject(ActivatedRoute).snapshot.data['title'] as string;
}