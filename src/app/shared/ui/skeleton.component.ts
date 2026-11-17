import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-skeleton',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" [attr.aria-label]="'state.loading' | transloco" class="space-y-3">
      @for (r of rowList(); track r) {
        <div class="h-11 animate-pulse rounded-[10px] bg-border"></div>
      }
    </div>
  `,
})
export class SkeletonComponent {
  readonly rows = input(5);
  readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}