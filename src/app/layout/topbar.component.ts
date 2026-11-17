import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '../core/auth/auth.store';
import { ThemeService } from '../core/theme/theme.service';
import { BreadcrumbsComponent } from './breadcrumbs.component';

@Component({
  selector: 'app-topbar',
  imports: [BreadcrumbsComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-16 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
        [attr.aria-label]="'nav.openMenu' | transloco" (click)="menuToggle.emit()">
        <i class="pi pi-bars"></i>
      </button>
      <div class="min-w-0 flex-1 overflow-x-auto"><app-breadcrumbs /></div>

      @if (auth.branches().length > 1) {
        <label for="branch" class="sr-only">{{ 'nav.branch' | transloco }}</label>
        <select id="branch" (change)="onBranch($event)"
          class="h-11 max-w-36 rounded-[10px] border border-input bg-card px-2 text-sm text-text focus-visible:outline-2 focus-visible:outline-accent sm:max-w-48">
          @for (b of auth.branches(); track b.id) {
            <option [value]="b.id" [selected]="b.id === auth.activeBranchId()">{{ b.name }}</option>
          }
        </select>
      }

      <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent"
        [attr.aria-label]="'common.theme' | transloco" (click)="theme.toggle()">
        <i [class]="theme.theme() === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"></i>
      </button>
      @if (auth.user(); as u) {
        <span class="hidden max-w-40 truncate text-sm text-text md:inline">{{ u.name }}</span>
      }
      <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent"
        [attr.aria-label]="'auth.logout' | transloco" (click)="logout()">
        <i class="pi pi-sign-out"></i>
      </button>
    </div>
  `,
})
export class TopbarComponent {
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly menuToggle = output<void>();

  onBranch(e: Event): void {
    this.auth.setActiveBranch(Number((e.target as HTMLSelectElement).value));
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}