import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '../core/auth/auth.store';
import { MenuItem, visibleMenu } from '../core/nav/menu.config';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex h-full flex-col bg-nav text-slate-300" [attr.aria-label]="'nav.main' | transloco">
      <div class="flex h-16 shrink-0 items-center gap-2 px-5 text-lg font-semibold text-white">
        <i class="pi pi-box text-accent"></i>
        <span>{{ 'app.name' | transloco }}</span>
      </div>
      <ul class="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        @for (item of items(); track item.key) {
          <li>
            @if (item.children) {
              <button type="button"
                class="flex h-11 w-full items-center gap-3 rounded-[10px] px-3 text-start hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent"
                [attr.aria-expanded]="isOpen(item.key)"
                (click)="toggle(item.key)">
                <i [class]="item.icon" aria-hidden="true"></i>
                <span class="flex-1">{{ 'menu.' + item.key | transloco }}</span>
                <i class="pi pi-chevron-down text-xs transition-transform" [class.rotate-180]="isOpen(item.key)" aria-hidden="true"></i>
              </button>
              @if (isOpen(item.key)) {
                <ul class="mt-1 space-y-1">
                  @for (child of item.children; track child.key) {
                    <li>
                      <a [routerLink]="'/' + child.path" routerLinkActive="bg-accent !text-white" (click)="navigate.emit()"
                        class="flex h-10 items-center gap-3 rounded-[10px] ps-10 pe-3 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent">
                        {{ 'menu.' + child.key | transloco }}
                      </a>
                    </li>
                  }
                </ul>
              }
            } @else {
              <a [routerLink]="'/' + item.path" routerLinkActive="bg-accent !text-white" (click)="navigate.emit()"
                class="flex h-11 items-center gap-3 rounded-[10px] px-3 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent">
                <i [class]="item.icon" aria-hidden="true"></i>
                <span>{{ 'menu.' + item.key | transloco }}</span>
              </a>
            }
          </li>
        }
      </ul>
    </nav>
  `,
})
export class SidebarComponent {
  private readonly auth = inject(AuthStore);

  readonly navigate = output<void>();
  readonly items = computed<MenuItem[]>(() => visibleMenu((k) => this.auth.can(k)));
  private readonly open = signal<ReadonlySet<string>>(new Set<string>());

  isOpen(key: string): boolean {
    return this.open().has(key);
  }

  toggle(key: string): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
}