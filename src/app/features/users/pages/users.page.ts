import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UserType } from '../../../core/auth/auth.models';
import { AuthStore } from '../../../core/auth/auth.store';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { DataTableComponent } from '../../../shared/ui/data-table/data-table.component';
import { RowAction, RowActionEvent, TableColumn, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { DateInputComponent } from '../../../shared/ui/date-input/date-input.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { NumberInputComponent } from '../../../shared/ui/number-input/number-input.component';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar/page-toolbar.component';
import { ManagedUser } from '../models/users.models';
import { UsersStore } from '../stores/users.store';
import { canManageUser, creatableTypes } from '../users.rules';

const INPUT = 'min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm';

@Component({
  selector: 'app-users-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HasPermissionDirective,
    PageToolbarComponent,
    DataTableComponent,
    CrudDialogComponent,
    FormFieldComponent,
    NumberInputComponent,
    DateInputComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-toolbar [title]="'users.title' | transloco">
      <button
        *hasPermission="'users.user.create'"
        type="button"
        class="min-h-12 rounded-lg bg-accent px-5 font-medium text-white"
        (click)="openForm(null)">
        {{ 'users.add' | transloco }}
      </button>
    </app-page-toolbar>

    @if (notice(); as n) {
      <p role="status" class="mb-3 rounded-lg bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-300">{{ n }}</p>
    }
    @if (actionError(); as e) {
      <p role="alert" class="mb-3 rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p>
    }

    <app-data-table
      [rows]="store.rows()"
      [columns]="columns"
      [total]="store.total()"
      [query]="store.query()"
      [loading]="store.loading()"
      [error]="loadError()"
      [actions]="actions"
      (queryChange)="onQuery($event)"
      (action)="onAction($event)"
      (retry)="reload()">
      <div filters class="flex flex-wrap gap-2">
        <select class="${INPUT} sm:w-auto" [attr.aria-label]="'users.type' | transloco" (change)="setFilter('type', $event)">
          <option value="">{{ 'users.allTypes' | transloco }}</option>
          @for (t of allTypes; track t) {
            <option [value]="t">{{ 'users.types.' + t | transloco }}</option>
          }
        </select>
        <select class="${INPUT} sm:w-auto" [attr.aria-label]="'users.role' | transloco" (change)="setFilter('roleId', $event)">
          <option value="">{{ 'users.allRoles' | transloco }}</option>
          @for (r of store.roles(); track r.id) {
            <option [value]="r.id">{{ r.name }}</option>
          }
        </select>
        <select class="${INPUT} sm:w-auto" [attr.aria-label]="'users.branches' | transloco" (change)="setFilter('branchId', $event)">
          <option value="">{{ 'users.allBranches' | transloco }}</option>
          @for (b of branches(); track b.id) {
            <option [value]="b.id">{{ b.name }}</option>
          }
        </select>
        <select class="${INPUT} sm:w-auto" [attr.aria-label]="'users.status' | transloco" (change)="setFilter('status', $event)">
          <option value="">{{ 'users.allStatuses' | transloco }}</option>
          <option value="active">{{ 'common.status.active' | transloco }}</option>
          <option value="inactive">{{ 'common.status.inactive' | transloco }}</option>
        </select>
      </div>
    </app-data-table>

    <app-crud-dialog
      [title]="(editingId() === null ? 'users.add' : 'users.edit') | transloco"
      [saving]="saving()"
      (save)="submit()"
      (closed)="saving.set(false)">
      <div [formGroup]="form" class="max-h-[65vh] space-y-4 overflow-y-auto pe-1">
        @if (formError(); as fe) {
          <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ fe }}</p>
        }

        <app-form-field #fName [label]="'users.name' | transloco" inputId="user-name" [control]="form.controls.name" [required]="true">
          <input placeholder="Enter full name..." id="user-name" formControlName="name" autocomplete="off" class="${INPUT}" [attr.aria-describedby]="fName.describedBy()" />
        </app-form-field>

        <app-form-field #fEmail [label]="'users.email' | transloco" inputId="user-email" [control]="form.controls.email" [required]="true">
          <input placeholder="Enter email address..." id="user-email" type="email" dir="ltr" formControlName="email" autocomplete="off" class="${INPUT}" [attr.aria-describedby]="fEmail.describedBy()" />
        </app-form-field>

        <app-form-field
          #fPass
          [label]="'users.password' | transloco"
          inputId="user-password"
          [control]="form.controls.password"
          [required]="false"
          [hint]="(editingId() === null ? 'users.passwordHint' : 'users.passwordEditHint') | transloco">
          <div class="flex gap-2">
            <input [placeholder]="(editingId() === null ? 'users.passwordInvitePh' : 'users.passwordEditPh') | transloco" id="user-password" [type]="showPw() ? 'text' : 'password'" dir="ltr" formControlName="password" autocomplete="new-password" class="${INPUT}" [attr.aria-describedby]="fPass.describedBy()" />
            <button type="button" class="min-h-11 shrink-0 rounded-lg border border-input px-3 text-sm" (click)="showPw.set(!showPw())">
              {{ (showPw() ? 'users.passwordHide' : 'users.passwordShow') | transloco }}
            </button>
            <button type="button" class="min-h-11 shrink-0 rounded-lg border border-input px-3 text-sm" (click)="generatePassword()">
              {{ 'users.passwordGenerate' | transloco }}
            </button>
          </div>
        </app-form-field>

        <app-form-field [label]="'users.type' | transloco" inputId="user-type" [control]="form.controls.type" [required]="true">
          <select id="user-type" formControlName="type" class="${INPUT}">
            @for (t of typeOptions(); track t) {
              <option [value]="t">{{ 'users.types.' + t | transloco }}</option>
            }
          </select>
        </app-form-field>

        @if (form.controls.type.value !== 'super_admin') {
          <app-form-field [label]="'users.role' | transloco" inputId="user-role" [control]="form.controls.roleId" [required]="true">
            <select id="user-role" formControlName="roleId" class="${INPUT}">
              <option [ngValue]="null">{{ 'users.selectRole' | transloco }}</option>
              @for (r of store.roles(); track r.id) {
                <option [ngValue]="r.id">{{ r.name }}</option>
              }
            </select>
          </app-form-field>
          @if (submitted() && missingRole()) {
            <p role="alert" class="-mt-3 text-xs text-red-600">{{ 'common.errors.required' | transloco }}</p>
          }

          <fieldset class="space-y-1">
            <legend class="text-sm font-medium">
              {{ 'users.branches' | transloco }}
              <span class="ms-1 text-red-600" aria-hidden="true">*</span>
            </legend>
            @for (b of branches(); track b.id) {
              <label class="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" class="size-5" [checked]="isBranchChecked(b.id)" (change)="toggleBranch(b.id, $event)" />
                {{ b.name }}
              </label>
            }
            @if (submitted() && missingBranch()) {
              <p role="alert" class="text-xs text-red-600">{{ 'users.branchesHint' | transloco }}</p>
            }
          </fieldset>

          <fieldset class="space-y-3 rounded-lg border border-border p-3">
            <legend class="px-1 text-sm font-medium">{{ 'users.limits' | transloco }}</legend>
            <app-form-field [label]="'users.discountPercent' | transloco" inputId="user-discount" [control]="form.controls.discountPercent">
              <app-number-input inputId="user-discount" formControlName="discountPercent" [decimals]="2" [min]="0" [max]="100" />
            </app-form-field>
            <app-form-field [label]="'users.adjustmentUnits' | transloco" inputId="user-adjust" [control]="form.controls.adjustmentUnits">
              <app-number-input inputId="user-adjust" formControlName="adjustmentUnits" [min]="0" />
            </app-form-field>
          </fieldset>

          <app-form-field
            #fExpiry
            [label]="'users.accessExpiry' | transloco"
            inputId="user-expiry"
            [control]="form.controls.accessExpiresAt"
            [hint]="'users.accessExpiryHint' | transloco">
            <app-date-input inputId="user-expiry" formControlName="accessExpiresAt" [min]="today" [describedBy]="fExpiry.describedBy()" />
          </app-form-field>
        }

        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="isActive" class="size-5" />
          {{ 'users.active' | transloco }}
        </label>
      </div>
    </app-crud-dialog>
  `,
})
export class UsersPage implements OnInit {
  protected readonly store = inject(UsersStore);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly dlg = viewChild.required(CrudDialogComponent);

  protected readonly allTypes: UserType[] = ['super_admin', 'admin', 'staff'];
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly branches = computed(() => this.auth.branches());

  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly typeOptions = signal<UserType[]>([]);
  protected readonly showPw = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    type: ['staff' as UserType, [Validators.required]],
    roleId: [null as number | null],
    branchIds: [[] as number[]],
    isActive: [true],
    discountPercent: [null as number | null],
    adjustmentUnits: [null as number | null],
    accessExpiresAt: [null as string | null],
    password: [''],
  });

  protected readonly columns: TableColumn<ManagedUser>[] = [
    { key: 'name', header: this.i18n.translate('users.name'), sortable: true },
    { key: 'email', header: this.i18n.translate('users.email'), sortable: true },
    { key: 'type', header: this.i18n.translate('users.type'), sortable: true, cell: (r) => this.i18n.translate('users.types.' + r.type) },
    { key: 'roleName', header: this.i18n.translate('users.role'), sortable: true, cell: (r) => r.roleName ?? '-' },
    {
      key: 'branchIds',
      header: this.i18n.translate('users.branches'),
      cell: (r) => this.branches().filter((b) => r.branchIds.includes(b.id)).map((b) => b.name).join(', ') || '-',
    },
    {
      key: 'isActive',
      header: this.i18n.translate('users.status'),
      cell: (r) => this.i18n.translate(r.isActive ? 'common.status.active' : 'common.status.inactive'),
    },
  ];

  protected readonly actions: RowAction<ManagedUser>[] = [
    { id: 'edit', label: this.i18n.translate('common.edit'), icon: 'pi pi-pencil', visible: (r) => this.canEdit(r) },
    { id: 'disable', label: this.i18n.translate('users.disable'), icon: 'pi pi-ban', visible: (r) => r.isActive && this.canEdit(r) && !this.isSelf(r) },
    { id: 'enable', label: this.i18n.translate('users.enable'), icon: 'pi pi-check-circle', visible: (r) => !r.isActive && this.canEdit(r) },
    { id: 'logout', label: this.i18n.translate('users.forceLogout'), icon: 'pi pi-sign-out', visible: (r) => this.canEdit(r) && !this.isSelf(r) },
    { id: 'reset', label: this.i18n.translate('users.resetPassword'), icon: 'pi pi-key', visible: (r) => this.canEdit(r) },
    { id: 'permissions', label: this.i18n.translate('users.permissions'), icon: 'pi pi-shield', visible: (r) => this.canEdit(r) && r.type !== 'super_admin' },
    { id: 'delete', label: this.i18n.translate('common.delete'), icon: 'pi pi-trash', danger: true, visible: (r) => this.auth.can('users.user.delete') && this.canManage(r) && !this.isSelf(r) },
  ];

  ngOnInit(): void {
    void this.store.loadRoles();
    void this.reload();
  }

  private actor(): UserType | undefined {
    return this.auth.user()?.type;
  }
  private canManage(r: ManagedUser): boolean {
    return canManageUser(this.actor(), r.type);
  }
  private canEdit(r: ManagedUser): boolean {
    return this.auth.can('users.user.edit') && this.canManage(r);
  }
  private isSelf(r: ManagedUser): boolean {
    return r.id === this.auth.user()?.id;
  }

  protected async reload(): Promise<void> {
    await this.run(() => this.store.load());
  }

  protected async onQuery(q: TableQuery): Promise<void> {
    await this.run(() => this.store.load(q));
  }

  protected async setFilter(key: string, e: Event): Promise<void> {
    const value = (e.target as HTMLSelectElement).value;
    const filters = { ...this.store.query().filters };
    if (value) filters[key] = value;
    else delete filters[key];
    await this.run(() => this.store.load({ ...this.store.query(), page: 1, filters }));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.loadError.set(null);
    try {
      await fn();
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected onAction(e: RowActionEvent<ManagedUser>): void {
    this.notice.set(null);
    this.actionError.set(null);
    switch (e.actionId) {
      case 'edit': this.openForm(e.row); break;
      case 'enable': void this.setActive(e.row, true); break;
      case 'disable': void this.askSetActive(e.row); break;
      case 'logout': void this.askLogout(e.row); break;
      case 'reset': void this.askReset(e.row); break;
      case 'permissions': void this.router.navigate(['/users-roles/users', e.row.id, 'permissions']); break;
      case 'delete': void this.askDelete(e.row); break;
    }
  }

  // ---------- form ----------
  protected openForm(row: ManagedUser | null): void {
    this.notice.set(null);
    this.actionError.set(null);
    this.formError.set(null);
    this.submitted.set(false);
    this.editingId.set(row?.id ?? null);

    const options = creatableTypes(this.actor());
    if (row && !options.includes(row.type)) options.push(row.type);
    this.typeOptions.set(options);

    this.form.reset({
      name: row?.name ?? '',
      email: row?.email ?? '',
      type: row?.type ?? 'staff',
      roleId: row?.roleId ?? null,
      branchIds: row?.branchIds ?? [],
      isActive: row?.isActive ?? true,
      discountPercent: row?.discountPercent ?? null,
      adjustmentUnits: row?.adjustmentUnits ?? null,
      accessExpiresAt: row?.accessExpiresAt ?? null,
      password: '',
    });
    // Naya user: password khaali chhoro to user ko email par code jata hai aur woh khud password banata hai.
    // Edit mein khaali = purana password rahega.
    const pw = this.form.controls.password;
    pw.setValidators([Validators.minLength(8)]);
    pw.updateValueAndValidity();
    this.showPw.set(false);
    // SuperAdmin ka type badla nahi ja sakta.
    if (row?.type === 'super_admin') this.form.controls.type.disable();
    else this.form.controls.type.enable();
    this.dlg().open();
  }

  protected isBranchChecked(id: number): boolean {
    return this.form.controls.branchIds.value.includes(id);
  }

  protected toggleBranch(id: number, e: Event): void {
    const on = (e.target as HTMLInputElement).checked;
    const cur = this.form.controls.branchIds.value;
    this.form.controls.branchIds.setValue(on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id));
  }

  protected generatePassword(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%';
    const buf = new Uint32Array(12);
    crypto.getRandomValues(buf);
    this.form.controls.password.setValue(Array.from(buf, (n) => chars[n % chars.length]).join(''));
    this.showPw.set(true);
  }

  protected missingRole(): boolean {
    const v = this.form.getRawValue();
    return v.type !== 'super_admin' && v.roleId === null;
  }

  protected missingBranch(): boolean {
    const v = this.form.getRawValue();
    return v.type !== 'super_admin' && v.branchIds.length === 0;
  }

  protected async submit(): Promise<void> {
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.missingRole() || this.missingBranch()) return;
    this.saving.set(true);
    this.formError.set(null);
    const v = this.form.getRawValue();
    const isSuper = v.type === 'super_admin';
    const err = await this.store.save(this.editingId(), {
      name: v.name.trim(),
      email: v.email.trim(),
      type: v.type,
      roleId: isSuper ? null : v.roleId,
      branchIds: isSuper ? [] : v.branchIds,
      isActive: v.isActive,
      discountPercent: isSuper ? null : v.discountPercent,
      adjustmentUnits: isSuper ? null : v.adjustmentUnits,
      accessExpiresAt: isSuper ? null : v.accessExpiresAt,
      ...(v.password ? { password: v.password } : {}),
    });
    this.saving.set(false);
    if (err) {
      this.formError.set(err);
      return;
    }
    this.dlg().close();
  }

  // ---------- row actions ----------
  private ask(title: string, message: string, confirmKey: string, danger = false): Promise<boolean> {
    return this.confirm.confirm({
      title: this.i18n.translate(title),
      message: this.i18n.translate(message),
      confirmLabel: this.i18n.translate(confirmKey),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger,
    });
  }

  private async askSetActive(row: ManagedUser): Promise<void> {
    if (await this.ask('users.disableTitle', 'users.disableMessage', 'users.disable', true)) {
      await this.setActive(row, false);
    }
  }

  private async setActive(row: ManagedUser, isActive: boolean): Promise<void> {
    this.actionError.set(await this.store.setActive(row.id, isActive));
  }

  private async askLogout(row: ManagedUser): Promise<void> {
    if (!(await this.ask('users.logoutTitle', 'users.logoutMessage', 'users.forceLogout'))) return;
    const err = await this.store.forceLogout(row.id);
    this.actionError.set(err);
    if (!err) this.notice.set(this.i18n.translate('users.done.logout'));
  }

  private async askReset(row: ManagedUser): Promise<void> {
    if (!(await this.ask('users.resetTitle', 'users.resetMessage', 'users.resetPassword'))) return;
    const err = await this.store.resetPassword(row.id);
    this.actionError.set(err);
    if (!err) this.notice.set(this.i18n.translate('users.done.reset'));
  }

  private async askDelete(row: ManagedUser): Promise<void> {
    if (!(await this.ask('users.deleteTitle', 'users.deleteMessage', 'common.delete', true))) return;
    this.actionError.set(await this.store.remove(row.id));
  }
}
