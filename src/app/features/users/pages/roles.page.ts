import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { RowAction, RowActionEvent, TableColumn, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { ListPageComponent } from '../../../shared/ui/list-page/list-page.component';
import { RoleListItem } from '../models/roles.models';
import { RolesStore } from '../stores/roles.store';

@Component({
  selector: 'app-roles-page',
  imports: [TranslocoPipe, ListPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-list-page
      [title]="'roles.title' | transloco"
      [addLabel]="'roles.add' | transloco"
      addPermission="users.role.create"
      [rows]="store.rows()"
      [columns]="columns"
      [total]="store.total()"
      [query]="store.query()"
      [loading]="store.loading()"
      [loadError]="loadError()"
      [actionError]="actionError()"
      [actions]="actions"
      (add)="create()"
      (queryChange)="onQuery($event)"
      (action)="onAction($event)"
      (retry)="reload()" />
  `,
})
export class RolesPage implements OnInit {
  protected readonly store = inject(RolesStore);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly columns: TableColumn<RoleListItem>[] = [
    { key: 'name', header: this.i18n.translate('roles.name'), sortable: true },
    { key: 'description', header: this.i18n.translate('roles.description') },
    { key: 'permissionCount', header: this.i18n.translate('roles.permissionCount'), sortable: true },
    { key: 'userCount', header: this.i18n.translate('roles.userCount'), sortable: true },
  ];

  protected readonly actions: RowAction<RoleListItem>[] = [
    { id: 'open', label: this.i18n.translate('roles.view'), icon: 'pi pi-eye', visible: () => !this.auth.can('users.role.edit') },
    { id: 'edit', label: this.i18n.translate('common.edit'), icon: 'pi pi-pencil', visible: () => this.auth.can('users.role.edit') },
    { id: 'clone', label: this.i18n.translate('roles.clone'), icon: 'pi pi-copy', visible: () => this.auth.can('users.role.create') },
    { id: 'delete', label: this.i18n.translate('common.delete'), icon: 'pi pi-trash', danger: true, visible: (r) => this.auth.can('users.role.delete') && !r.isSystem },
  ];

  ngOnInit(): void {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    await this.run(() => this.store.load());
  }

  protected async onQuery(q: TableQuery): Promise<void> {
    await this.run(() => this.store.load(q));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.loadError.set(null);
    try {
      await fn();
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected create(): void {
    void this.router.navigate(['/users-roles/roles/new']);
  }

  protected onAction(e: RowActionEvent<RoleListItem>): void {
    this.actionError.set(null);
    if (e.actionId === 'open' || e.actionId === 'edit') {
      void this.router.navigate(['/users-roles/roles', e.row.id]);
    } else if (e.actionId === 'clone') {
      void this.router.navigate(['/users-roles/roles/new'], { queryParams: { cloneFrom: e.row.id } });
    } else if (e.actionId === 'delete') {
      void this.askDelete(e.row);
    }
  }

  private async askDelete(row: RoleListItem): Promise<void> {
    const yes = await this.confirm.confirm({
      title: this.i18n.translate('roles.deleteTitle'),
      message: this.i18n.translate('roles.deleteMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (!yes) return;
    this.actionError.set(await this.store.remove(row.id));
  }
}
