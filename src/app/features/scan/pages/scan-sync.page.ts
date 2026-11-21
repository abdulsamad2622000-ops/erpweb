import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI } from '../../purchase/utils/ui';
import { OfflineQueueService } from '../services/offline-queue.service';

/** Phone mein save hue scans ki list: intezar mein, ya server ne mana kiya (conflict). */
@Component({
  selector: 'app-scan-sync-page',
  imports: [TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl space-y-4">
      <div>
        <h1 class="text-xl font-semibold">{{ 'scanApp.sync.title' | transloco }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'scanApp.sync.hint' | transloco }}</p>
      </div>

      @if (!queue.online()) {
        <p role="status" class="rounded-xl border border-amber-600 p-3 text-sm text-amber-800 dark:text-amber-400">
          {{ 'scanApp.sync.offlineNote' | transloco }}
        </p>
      }

      <button
        type="button"
        class="min-h-12 w-full rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white disabled:opacity-50"
        [disabled]="!queue.online() || queue.syncing() || queue.pendingCount() === 0"
        (click)="queue.sync()"
      >
        {{ 'scanApp.sync.syncNow' | transloco }}
      </button>

      @if (queue.items().length === 0) {
        <p class="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          {{ 'scanApp.sync.empty' | transloco }}
        </p>
      } @else {
        <ul class="space-y-3">
          @for (i of queue.items(); track i.id) {
            <li [class]="ui.card + ' space-y-2'">
              <div class="flex items-center justify-between gap-2">
                <span class="font-semibold">{{ 'scanApp.sync.kinds.' + i.payload.kind | transloco }}</span>
                <app-status-badge
                  [label]="'scanApp.sync.' + i.status | transloco"
                  [tone]="i.status === 'conflict' ? 'danger' : 'warning'"
                />
              </div>
              <p class="text-sm"><code dir="ltr">{{ i.label }}</code></p>
              <p class="text-xs text-slate-600 dark:text-slate-400">{{ i.createdAt.slice(0, 16).replace('T', ' ') }}</p>
              @if (i.error) {
                <p role="alert" class="text-sm text-red-600">{{ i.error }}</p>
              }
              <div class="flex gap-2">
                @if (i.status === 'conflict') {
                  <button type="button" class="min-h-12 flex-1 rounded-lg border border-slate-400 px-4 text-sm" (click)="queue.retry(i.id)">
                    {{ 'scanApp.sync.retry' | transloco }}
                  </button>
                }
                <button type="button" class="min-h-12 flex-1 rounded-lg border border-red-600 px-4 text-sm text-red-600" (click)="discard(i.id)">
                  {{ 'scanApp.sync.discard' | transloco }}
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class ScanSyncPage {
  protected readonly queue = inject(OfflineQueueService);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;

  protected async discard(id: string): Promise<void> {
    const yes = await this.dialogs.confirm({
      title: this.i18n.translate('scanApp.sync.discardTitle'),
      message: this.i18n.translate('scanApp.sync.discardMessage'),
      confirmLabel: this.i18n.translate('scanApp.sync.discard'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (yes) await this.queue.discard(id);
  }
}