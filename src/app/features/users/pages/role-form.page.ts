import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar/page-toolbar.component';
import {
  PERMISSION_MODULES,
  PermissionModule,
  ROLE_TEMPLATES,
  grantableKeys,
  moduleKeys,
} from '../permission-registry';
import { RolesStore } from '../stores/roles.store';

const INPUT = 'min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm';

@Component({
  selector: 'app-role-form-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, PageToolbarComponent, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-toolbar
      [title]="titleKey() | transloco"
      [breadcrumbs]="[{ label: 'menu.roles' | transloco, link: '/users-roles/roles' }, { label: titleKey() | transloco }]" />

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
        <a routerLink="/users-roles/roles" class="inline-flex min-h-12 items-center rounded-lg border border-input px-5 font-medium">
          {{ 'roles.back' | transloco }}
        </a>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4" novalidate>
        @if (formError(); as fe) {
          <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ fe }}</p>
        }
        @if (!canSave()) {
          <p class="text-sm text-muted">{{ 'roles.readOnly' | transloco }}</p>
        }

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <app-form-field #fName [label]="'roles.name' | transloco" inputId="role-name" [control]="form.controls.name" [required]="true">
            <input placeholder="Enter full name..." id="role-name" formControlName="name" autocomplete="off" class="${INPUT}" [attr.aria-describedby]="fName.describedBy()" />
          </app-form-field>
          <app-form-field #fDesc [label]="'roles.description' | transloco" inputId="role-desc" [control]="form.controls.description">
            <input placeholder="Enter role desc..." id="role-desc" formControlName="description" autocomplete="off" class="${INPUT}" [attr.aria-describedby]="fDesc.describedBy()" />
          </app-form-field>
        </div>

        @if (id === null && canSave()) {
          <div class="flex flex-col gap-1.5 md:max-w-sm">
            <label for="role-template" class="text-sm font-medium">{{ 'roles.template' | transloco }}</label>
            <select id="role-template" class="${INPUT}" (change)="applyTemplate($event)">
              <option value="">{{ 'roles.noTemplate' | transloco }}</option>
              @for (t of templates; track t.name; let i = $index) {
                <option [value]="i">{{ t.name }}</option>
              }
            </select>
          </div>
        }

        <p class="text-sm" aria-live="polite">{{ 'roles.selected' | transloco: { count: selectedCount() } }}</p>
        @if (canSave() && !isSuper()) {
          <p class="text-xs text-muted">{{ 'roles.notGrantable' | transloco }}</p>
        }

        @for (m of modules; track m.key) {
          <details class="rounded-xl border border-border bg-card" open>
            <summary class="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4">
              <span class="font-semibold">{{ m.label }}</span>
              <span class="text-xs text-muted">{{ moduleCount(m) }} / {{ moduleTotal(m) }}</span>
            </summary>
            <div class="space-y-1 border-t border-border p-2">
              <label class="flex min-h-11 items-center gap-2 px-2 text-sm font-medium">
                <input
                  type="checkbox"
                  class="size-5"
                  [checked]="moduleAll(m)"
                  [disabled]="!moduleEditable(m)"
                  (change)="toggleModule(m, $event)" />
                {{ 'roles.selectAll' | transloco }}
              </label>
              @for (r of m.rows; track r.prefix) {
                <div class="flex flex-wrap items-center gap-x-4 gap-y-0 rounded-lg px-2 hover:bg-page">
                  <span class="w-44 text-sm">{{ r.label }}</span>
                  @for (p of r.perms; track p.key) {
                    <label class="flex min-h-11 items-center gap-2 text-sm capitalize" [class.opacity-50]="!editable(p.key)">
                      <input
                        type="checkbox"
                        class="size-5"
                        [checked]="has(p.key)"
                        [disabled]="!editable(p.key)"
                        (change)="toggle(p.key, $event)" />
                      {{ p.action }}
                    </label>
                  }
                </div>
              }
            </div>
          </details>
        }

        <div class="sticky bottom-0 flex flex-wrap gap-2 border-t border-border bg-page py-3">
          @if (canSave()) {
            <button type="submit" class="min-h-12 rounded-lg bg-accent px-6 font-medium text-white disabled:opacity-50" [disabled]="saving()">
              {{ 'roles.save' | transloco }}
            </button>
          }
          <a routerLink="/users-roles/roles" class="inline-flex min-h-12 items-center rounded-lg border border-input px-6 font-medium">
            {{ 'roles.back' | transloco }}
          </a>
        </div>
      </form>
    }
  `,
})
export class RoleFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(RolesStore);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);

  protected readonly modules = PERMISSION_MODULES;
  protected readonly templates = ROLE_TEMPLATES;

  private readonly idParam = this.route.snapshot.paramMap.get('id');
  protected readonly id: number | null = this.idParam && this.idParam !== 'new' ? Number(this.idParam) : null;

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    description: ['', [Validators.maxLength(200)]],
  });

  protected readonly isSuper = computed(() => this.auth.user()?.type === 'super_admin');
  protected readonly grantable = computed(() => grantableKeys(this.auth.user()?.type, this.auth.grantedKeys()));
  protected readonly canSave = computed(() => this.auth.can(this.id === null ? 'users.role.create' : 'users.role.edit'));
  protected readonly selectedCount = computed(() => this.selected().size);
  protected readonly titleKey = computed(() =>
    this.id === null ? 'roles.newTitle' : this.canSave() ? 'roles.editTitle' : 'roles.viewTitle',
  );

  async ngOnInit(): Promise<void> {
    const clone = this.route.snapshot.queryParamMap.get('cloneFrom');
    const source = this.id ?? (clone ? Number(clone) : null);
    if (source === null) return;
    this.loading.set(true);
    try {
      const role = await this.store.get(source);
      const cloning = this.id === null;
      this.form.patchValue({
        name: cloning ? this.i18n.translate('roles.copyOf', { name: role.name }) : role.name,
        description: role.description,
      });
      // Clone mein wo permissions nahi aati jo dene ka haq nahi.
      const perms = cloning ? role.permissions.filter((k) => this.grantable().has(k)) : role.permissions;
      this.selected.set(new Set(perms));
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  protected editable(key: string): boolean {
    return this.canSave() && this.grantable().has(key);
  }
  protected has(key: string): boolean {
    return this.selected().has(key);
  }

  private setMany(keys: string[], on: boolean): void {
    this.selected.update((s) => {
      const next = new Set(s);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }

  protected toggle(key: string, e: Event): void {
    this.setMany([key], (e.target as HTMLInputElement).checked);
  }

  protected toggleModule(m: PermissionModule, e: Event): void {
    this.setMany(moduleKeys(m).filter((k) => this.editable(k)), (e.target as HTMLInputElement).checked);
  }

  protected moduleTotal(m: PermissionModule): number {
    return moduleKeys(m).length;
  }
  protected moduleCount(m: PermissionModule): number {
    return moduleKeys(m).filter((k) => this.has(k)).length;
  }
  protected moduleEditable(m: PermissionModule): boolean {
    return moduleKeys(m).some((k) => this.editable(k));
  }
  protected moduleAll(m: PermissionModule): boolean {
    const keys = moduleKeys(m).filter((k) => this.editable(k));
    return keys.length > 0 && keys.every((k) => this.has(k));
  }

  protected applyTemplate(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    if (v === '') return;
    const t = ROLE_TEMPLATES[Number(v)];
    this.selected.set(new Set(t.permissions.filter((k) => this.grantable().has(k))));
    if (!this.form.controls.description.value) this.form.controls.description.setValue(t.description);
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.canSave()) return;
    this.saving.set(true);
    this.formError.set(null);
    const v = this.form.getRawValue();
    const err = await this.store.save(this.id, {
      name: v.name.trim(),
      description: v.description.trim(),
      permissions: [...this.selected()].sort(),
    });
    this.saving.set(false);
    if (err) {
      this.formError.set(err);
      return;
    }
    await this.router.navigate(['/users-roles/roles']);
  }
}
