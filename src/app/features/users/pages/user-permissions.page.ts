import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar/page-toolbar.component';
import { OverrideMode, UserPermissions } from '../models/permissions.models';
import { PERMISSION_MODULES, PermissionModule, grantableKeys, moduleKeys } from '../permission-registry';
import { UserPermissionsStore } from '../stores/permissions.store';

@Component({
  selector: 'app-user-permissions-page',
  imports: [RouterLink, TranslocoPipe, PageToolbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-toolbar
      [title]="'overrides.title' | transloco"
      [subtitle]="info()?.userName ?? ''"
      [breadcrumbs]="[{ label: 'menu.users' | transloco, link: '/users-roles/users' }, { label: 'overrides.title' | transloco }]" />

    @if (loading()) {
      <div class="space-y-2" role="status">
        <span class="sr-only">{{ 'common.loading' | transloco }}</span>
        @for (i of [1, 2, 3]; track i) {
          <div class="h-14 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800"></div>
        }
      </div>
    } @else if (loadError(); as le) {
      <div class="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center" role="alert">
        <i class="pi pi-exclamation-triangle text-3xl text-red-600" aria-hidden="true"></i>
        <p class="text-sm">{{ le }}</p>
        <a routerLink="/users-roles/users" class="inline-flex min-h-12 items-center rounded-lg border border-input px-5 font-medium">
          {{ 'overrides.back' | transloco }}
        </a>
      </div>
    } @else {
      <div class="space-y-4">
        <p class="text-sm text-muted">{{ 'overrides.intro' | transloco }}</p>
        <p class="text-sm">
          <span class="font-medium">{{ 'overrides.role' | transloco }}:</span>
          {{ info()?.roleName ?? ('overrides.noRole' | transloco) }}
          <span class="ms-3" aria-live="polite">{{ 'overrides.count' | transloco: { count: overrideCount() } }}</span>
        </p>
        @if (!isSuper()) {
          <p class="text-xs text-muted">{{ 'overrides.notGrantable' | transloco }}</p>
        }

        @if (notice(); as n) {
          <p role="status" class="rounded-lg bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-300">{{ n }}</p>
        }
        @if (formError(); as fe) {
          <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ fe }}</p>
        }

        @for (m of modules; track m.key) {
          <details class="rounded-xl border border-border bg-card" open>
            <summary class="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4">
              <span class="font-semibold">{{ m.label }}</span>
              <span class="text-xs text-muted">{{ moduleOverrides(m) }} / {{ moduleTotal(m) }}</span>
            </summary>
            <div class="space-y-1 border-t border-border p-2">
              @for (r of m.rows; track r.prefix) {
                @for (p of r.perms; track p.key) {
                  <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg px-2 py-1 hover:bg-page">
                    <div class="min-w-0 text-sm">
                      <span>{{ r.label }}</span>
                      <span class="ms-1 capitalize text-muted">{{ p.action }}</span>
                      <span class="ms-2 text-xs text-muted">{{ (roleHas(p.key) ? 'overrides.roleHas' : 'overrides.roleHasNot') | transloco }}</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-3">
                      <span class="text-xs" [class]="effective(p.key) ? 'text-green-600 dark:text-green-400' : 'text-muted'">
                        {{ (effective(p.key) ? 'overrides.granted' : 'overrides.notGranted') | transloco }}
                      </span>
                      <div role="group" [attr.aria-label]="r.label + ' ' + p.action" class="inline-flex overflow-hidden rounded-lg border border-input">
                        @for (mode of modes; track mode) {
                          <button
                            type="button"
                            class="min-h-11 px-3 text-sm disabled:opacity-60"
                            [class]="btnClass(p.key, mode)"
                            [attr.aria-pressed]="modeOf(p.key) === mode"
                            [disabled]="!canSet(p.key, mode)"
                            (click)="setMode(p.key, mode)">
                            {{ 'overrides.mode.' + mode | transloco }}
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                }
              }
            </div>
          </details>
        }

        <div class="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-page py-3">
          <button type="button" class="min-h-12 rounded-lg bg-accent px-6 font-medium text-white disabled:opacity-50" [disabled]="saving()" (click)="save()">
            {{ 'overrides.save' | transloco }}
          </button>
          <button type="button" class="min-h-12 rounded-lg border border-input px-6 font-medium" (click)="clearAll()">
            {{ 'overrides.clear' | transloco }}
          </button>
          <a routerLink="/users-roles/users" class="inline-flex min-h-12 items-center rounded-lg border border-input px-6 font-medium">
            {{ 'overrides.back' | transloco }}
          </a>
        </div>
      </div>
    }
  `,
})
export class UserPermissionsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(UserPermissionsStore);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);

  protected readonly modules = PERMISSION_MODULES;
  protected readonly modes: OverrideMode[] = ['default', 'allow', 'deny'];
  private readonly userId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly info = signal<UserPermissions | null>(null);
  protected readonly overrides = signal<Readonly<Record<string, 'allow' | 'deny'>>>({});

  private readonly roleSet = computed(() => new Set(this.info()?.rolePermissions ?? []));
  protected readonly isSuper = computed(() => this.auth.user()?.type === 'super_admin');
  private readonly grantable = computed(() => grantableKeys(this.auth.user()?.type, this.auth.grantedKeys()));
  protected readonly overrideCount = computed(() => Object.keys(this.overrides()).length);

  async ngOnInit(): Promise<void> {
    try {
      const data = await this.store.get(this.userId);
      this.info.set(data);
      const o: Record<string, 'allow' | 'deny'> = {};
      for (const k of data.allow) o[k] = 'allow';
      for (const k of data.deny) o[k] = 'deny';
      this.overrides.set(o);
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  protected modeOf(key: string): OverrideMode {
    return this.overrides()[key] ?? 'default';
  }
  protected roleHas(key: string): boolean {
    return this.roleSet().has(key);
  }
  protected effective(key: string): boolean {
    const m = this.overrides()[key];
    return m ? m === 'allow' : this.roleHas(key);
  }
  /** Allow sirf wohi permission ho sakti hai jo dene wale ke paas khud ho. */
  protected canSet(key: string, mode: OverrideMode): boolean {
    return mode !== 'allow' || this.grantable().has(key) || this.modeOf(key) === 'allow';
  }

  protected btnClass(key: string, mode: OverrideMode): string {
    if (this.modeOf(key) !== mode) return 'bg-transparent hover:bg-page';
    if (mode === 'allow') return 'bg-green-600 text-white';
    if (mode === 'deny') return 'bg-red-600 text-white';
    return 'bg-accent text-white';
  }

  protected setMode(key: string, mode: OverrideMode): void {
    this.notice.set(null);
    this.overrides.update((o) => {
      const next = { ...o };
      if (mode === 'default') delete next[key];
      else next[key] = mode;
      return next;
    });
  }

  protected clearAll(): void {
    this.notice.set(null);
    this.overrides.set({});
  }

  protected moduleTotal(m: PermissionModule): number {
    return moduleKeys(m).length;
  }
  protected moduleOverrides(m: PermissionModule): number {
    return moduleKeys(m).filter((k) => this.overrides()[k] !== undefined).length;
  }

  protected async save(): Promise<void> {
    this.saving.set(true);
    this.formError.set(null);
    this.notice.set(null);
    const o = this.overrides();
    const keys = Object.keys(o).sort();
    const err = await this.store.save(this.userId, {
      allow: keys.filter((k) => o[k] === 'allow'),
      deny: keys.filter((k) => o[k] === 'deny'),
    });
    this.saving.set(false);
    if (err) {
      this.formError.set(err);
      return;
    }
    this.notice.set(this.i18n.translate('overrides.saved'));
  }
}
