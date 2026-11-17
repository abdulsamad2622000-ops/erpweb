import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-page-toolbar',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        @if (breadcrumbs().length) {
          <nav aria-label="Breadcrumb" class="mb-1">
            <ol class="flex flex-wrap items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
              @for (c of breadcrumbs(); track c.label; let last = $last) {
                <li class="flex items-center gap-1">
                  @if (c.link && !last) {
                    <a [routerLink]="c.link" class="underline-offset-2 hover:underline">{{ c.label }}</a>
                  } @else {
                    <span [attr.aria-current]="last ? 'page' : null">{{ c.label }}</span>
                  }
                  @if (!last) {
                    <i class="pi pi-angle-right text-[10px]" aria-hidden="true"></i>
                  }
                </li>
              }
            </ol>
          </nav>
        }
        <h1 class="truncate text-xl font-semibold text-slate-900 dark:text-slate-50">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="text-sm text-slate-600 dark:text-slate-400">{{ subtitle() }}</p>
        }
      </div>

      <!-- Primary action. Parent apna button yahan dalega, e.g.
           <button *hasPermission="'products.product.create'"> -->
      <div class="flex items-center gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageToolbarComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly breadcrumbs = input<Crumb[]>([]);
}
