import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SettingsStore } from '../stores/settings.store';

@Component({
  selector: 'app-backup-page',
  imports: [DatePipe, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'settingsPage.backup.title' | transloco }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'settingsPage.backup.note' | transloco }}</p>

      @if (loadError(); as msg) {
        <div role="alert" class="rounded-xl border border-red-600 p-4 text-sm text-red-600">
          <p>{{ msg }}</p>
          <button type="button" class="mt-3 min-h-12 rounded-lg border border-red-600 px-5" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      } @else if (store.backup(); as b) {
        <dl
          class="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900"
        >
          <div>
            <dt class="text-xs text-slate-600 dark:text-slate-400">{{ 'settingsPage.backup.status' | transloco }}</dt>
            <dd
              class="text-sm font-medium"
              [class.text-green-600]="b.status === 'ok'"
              [class.text-red-600]="b.status === 'failed'"
            >
              {{ 'settingsPage.backup.statuses.' + b.status | transloco }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-slate-600 dark:text-slate-400">{{ 'settingsPage.backup.last' | transloco }}</dt>
            <dd class="text-sm font-medium">
              @if (b.lastBackupAt) {
                {{ b.lastBackupAt | date: 'medium' }}
              } @else {
                {{ 'settingsPage.backup.never' | transloco }}
              }
            </dd>
          </div>
          <div>
            <dt class="text-xs text-slate-600 dark:text-slate-400">{{ 'settingsPage.backup.frequency' | transloco }}</dt>
            <dd class="text-sm font-medium">{{ 'settingsPage.backup.frequencies.' + b.frequency | transloco }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-600 dark:text-slate-400">{{ 'settingsPage.backup.time' | transloco }}</dt>
            <dd class="text-sm font-medium" dir="ltr">{{ b.time }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-600 dark:text-slate-400">{{ 'settingsPage.backup.retention' | transloco }}</dt>
            <dd class="text-sm font-medium">{{ 'settingsPage.backup.days' | transloco: { days: b.retentionDays } }}</dd>
          </div>
          <div>
            <dt class="text-xs text-slate-600 dark:text-slate-400">{{ 'settingsPage.backup.location' | transloco }}</dt>
            <dd class="text-sm font-medium">{{ b.location }}</dd>
          </div>
        </dl>
      } @else {
        <div role="status" class="animate-pulse space-y-3">
          <span class="sr-only">{{ 'state.loading' | transloco }}</span>
          <div class="h-24 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
        </div>
      }
    </section>
  `,
})
export class BackupPage implements OnInit {
  protected readonly store = inject(SettingsStore);
  private readonly i18n = inject(TranslocoService);

  protected readonly loadError = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadError.set(null);
    try {
      await this.store.loadBackup();
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }
}