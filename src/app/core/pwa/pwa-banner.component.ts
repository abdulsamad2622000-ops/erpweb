import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PwaService } from './pwa.service';

/** Update prompt (showUpdate) aur install / iOS hint (showInstall). */
@Component({
  selector: 'app-pwa-banner',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showUpdate() && pwa.updateReady()) {
      <div role="status" class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">
        <span class="min-w-0 flex-1">{{ 'scanApp.update.message' | transloco }}</span>
        <button type="button" class="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white" (click)="pwa.applyUpdate()">{{ 'scanApp.update.button' | transloco }}</button>
      </div>
    }

    @if (showInstall() && pwa.canInstall()) {
      <div role="region" [attr.aria-label]="'scanApp.install.title' | transloco" class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{{ 'scanApp.install.title' | transloco }}</p>
          <p class="text-slate-600 dark:text-slate-400">{{ 'scanApp.install.hint' | transloco }}</p>
        </div>
        <button type="button" class="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white" (click)="pwa.install()">{{ 'scanApp.install.button' | transloco }}</button>
        <button type="button" class="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-400 px-4 text-sm" (click)="pwa.dismissInstall()">{{ 'scanApp.install.dismiss' | transloco }}</button>
      </div>
    }

    @if (showInstall() && pwa.showIosHint()) {
      <div role="region" [attr.aria-label]="'scanApp.install.title' | transloco" class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{{ 'scanApp.install.title' | transloco }}</p>
          <p class="text-slate-600 dark:text-slate-400">{{ 'scanApp.install.iosHint' | transloco }}</p>
        </div>
        <button type="button" class="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-400 px-4 text-sm" (click)="pwa.dismissInstall()">{{ 'scanApp.install.dismiss' | transloco }}</button>
      </div>
    }
  `,
})
export class PwaBannerComponent {
  protected readonly pwa = inject(PwaService);
  readonly showInstall = input(false);
  readonly showUpdate = input(true);
}