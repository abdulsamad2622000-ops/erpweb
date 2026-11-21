import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { injectCan } from '../../../core/auth/can';
import { PwaBannerComponent } from '../../../core/pwa/pwa-banner.component';

interface ScanTile {
  key: string;
  path: string;
  icon: string;
  permission: string;
}

/** Naye scan screens (transfer, count) yahan ek ek line se judenge. */
const TILES: ScanTile[] = [
  { key: 'putaway', path: '/scan/putaway', icon: 'pi pi-download', permission: 'inventory.transfer.create' },
  { key: 'transfers', path: '/scan/transfers', icon: 'pi pi-truck', permission: 'inventory.transfer.create' },
  { key: 'counts', path: '/scan/counts', icon: 'pi pi-list-check', permission: 'inventory.count.create' },
  { key: 'lookup', path: '/scan/lookup', icon: 'pi pi-search', permission: 'inventory.serial.view' },
];

@Component({
  selector: 'app-scan-home-page',
  imports: [PwaBannerComponent, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl space-y-4">
      <app-pwa-banner [showInstall]="true" [showUpdate]="false" />
      <div>
        <h1 class="text-xl font-semibold">{{ 'scanApp.homeTitle' | transloco }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'scanApp.homeHint' | transloco }}</p>
      </div>

      @if (tiles.length === 0) {
        <p role="status" class="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          {{ 'scanApp.noAccess' | transloco }}
        </p>
      } @else {
        <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          @for (t of tiles; track t.key) {
            <li>
              <a
                [routerLink]="t.path"
                class="flex min-h-28 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
              >
                <span class="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#2563EB] text-white">
                  <i [class]="t.icon + ' text-2xl'" aria-hidden="true"></i>
                </span>
                <span class="min-w-0">
                  <span class="block text-base font-semibold">{{ 'scanApp.tiles.' + t.key + '.title' | transloco }}</span>
                  <span class="block text-sm text-slate-600 dark:text-slate-400">{{ 'scanApp.tiles.' + t.key + '.desc' | transloco }}</span>
                </span>
              </a>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class ScanHomePage {
  private readonly can = injectCan();
  protected readonly tiles = TILES.filter((t) => this.can(t.permission));
}