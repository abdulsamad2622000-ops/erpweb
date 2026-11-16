import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map, startWith } from 'rxjs';
import { MENU, MenuItem } from '../core/nav/menu.config';

function allItems(items: MenuItem[]): MenuItem[] {
  return items.flatMap((i) => [i, ...(i.children ? allItems(i.children) : [])]);
}
const ALL = allItems(MENU);

interface Crumb {
  url: string;
  key: string | null;
  label: string;
  link: boolean;
}

@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="'nav.breadcrumb' | transloco">
      <ol class="flex items-center gap-1 text-sm text-muted">
        <li>
          <a routerLink="/dashboard" class="inline-flex h-8 items-center rounded px-1 hover:text-text focus-visible:outline-2 focus-visible:outline-accent" [attr.aria-label]="'common.home' | transloco">
            <i class="pi pi-home"></i>
          </a>
        </li>
        @for (c of crumbs(); track c.url; let last = $last) {
          <li class="flex items-center gap-1">
            <i class="pi pi-angle-right text-xs rtl:rotate-180" aria-hidden="true"></i>
            @if (c.link && !last) {
              <a [routerLink]="c.url" class="rounded px-1 hover:text-text focus-visible:outline-2 focus-visible:outline-accent">{{ c.key ? ('menu.' + c.key | transloco) : c.label }}</a>
            } @else {
              <span [class]="last ? 'px-1 font-medium text-text' : 'px-1'" [attr.aria-current]="last ? 'page' : null">{{ c.key ? ('menu.' + c.key | transloco) : c.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbsComponent {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly crumbs = computed<Crumb[]>(() => {
    const segs = this.url().split('?')[0].split('/').filter(Boolean);
    return segs.map((seg, i) => {
      const path = segs.slice(0, i + 1).join('/');
      const item = ALL.find((m) => m.path === path);
      return { url: '/' + path, key: item?.key ?? null, label: seg, link: !!item && !item.children };
    });
  });
}