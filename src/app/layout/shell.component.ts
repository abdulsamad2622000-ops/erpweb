import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="min-h-screen lg:flex">
      @if (drawerOpen()) {
        <div class="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-hidden="true" (click)="close()"></div>
      }
      <aside
        class="fixed inset-y-0 start-0 z-40 w-64 transition-transform lg:sticky lg:top-0 lg:h-screen lg:shrink-0"
        [class]="drawerOpen() ? '' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full'">
        <app-sidebar (navigate)="close()" />
      </aside>
      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar (menuToggle)="open()" />
        <main class="flex-1 p-4 lg:p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  readonly drawerOpen = signal(false);
  open(): void { this.drawerOpen.set(true); }
  close(): void { this.drawerOpen.set(false); }
}