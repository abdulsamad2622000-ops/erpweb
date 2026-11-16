import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageService } from '../core/i18n/language.service';
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
      <button type="button" class="inline-flex h-11 min-w-11 items-center justify-center rounded-[10px] px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent"
        [attr.aria-label]="'common.language' | transloco" (click)="toggleLang()">
        {{ lang.lang() === 'en' ? 'اردو' : 'English' }}
      </button>
      <button type="button" class="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent"
        [attr.aria-label]="'common.theme' | transloco" (click)="theme.toggle()">
        <i [class]="theme.theme() === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"></i>
      </button>
    </div>
  `,
})
export class TopbarComponent {
  readonly lang = inject(LanguageService);
  readonly theme = inject(ThemeService);
  readonly menuToggle = output<void>();

  toggleLang(): void {
    this.lang.set(this.lang.lang() === 'en' ? 'ur' : 'en');
  }
}