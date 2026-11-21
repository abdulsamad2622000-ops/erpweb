import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PwaBannerComponent } from '../../core/pwa/pwa-banner.component';
import { OfflineQueueService } from './services/offline-queue.service';

/**
 * Phone ke liye full-screen layout: sidebar nahi, bade touch targets (48px).
 * Upar sync chip: offline, syncing, kitne items intezar mein, kitne ko dekhna hai.
 */
@Component({
  selector: 'app-scan-layout',
  imports: [PwaBannerComponent, RouterOutlet, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh flex-col bg-[#F6F7F9] text-[#0F172A] dark:bg-slate-950 dark:text-slate-100">
      <header class="sticky top-0 z-20 flex items-center gap-2 bg-[#0F172A] px-2 py-2 text-white">
        <a
          routerLink="/scan"
          class="inline-flex h-12 w-12 items-center justify-center rounded-lg hover:bg-white/10"
          [attr.aria-label]="'scanApp.home' | transloco"
        >
          <i class="pi pi-home text-xl" aria-hidden="true"></i>
        </a>
        <span class="flex-1 truncate text-base font-semibold">{{ 'scanApp.title' | transloco }}</span>
        @if (chip(); as c) {
          <a
            routerLink="/scan/sync"
            role="status"
            [class]="'inline-flex min-h-12 items-center gap-1.5 rounded-full px-3 text-xs font-medium ' + c.cls"
          >
            <i [class]="c.icon" aria-hidden="true"></i>
            {{ c.key | transloco: { n: c.n } }}
          </a>
        }
        <a
          routerLink="/dashboard"
          class="inline-flex h-12 w-12 items-center justify-center rounded-lg hover:bg-white/10"
          [attr.aria-label]="'scanApp.desktop' | transloco"
        >
          <i class="pi pi-desktop text-xl" aria-hidden="true"></i>
        </a>
      </header>
      <main class="flex-1 p-4">
        <app-pwa-banner />
        <router-outlet />
      </main>
    </div>
  `,
})
export class ScanLayoutComponent implements OnInit {
  private readonly queue = inject(OfflineQueueService);

  protected readonly chip = computed(() => {
    const pending = this.queue.pendingCount();
    const conflicts = this.queue.conflictCount();
    if (conflicts > 0) {
      return { cls: 'bg-red-100 text-red-800', icon: 'pi pi-exclamation-circle', key: 'scanApp.sync.chipConflict', n: conflicts };
    }
    if (!this.queue.online()) {
      return { cls: 'bg-amber-100 text-amber-800', icon: 'pi pi-exclamation-triangle', key: 'scanApp.sync.chipOffline', n: pending };
    }
    if (this.queue.syncing()) {
      return { cls: 'bg-blue-100 text-blue-800', icon: 'pi pi-sync', key: 'scanApp.sync.chipSyncing', n: pending };
    }
    if (pending > 0) {
      return { cls: 'bg-amber-100 text-amber-800', icon: 'pi pi-clock', key: 'scanApp.sync.chipWaiting', n: pending };
    }
    return null;
  });

  ngOnInit(): void {
    void this.queue.sync();
  }
}