import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TableColumn, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { ListPageComponent } from '../../../shared/ui/list-page/list-page.component';
import { AuditEntry } from '../models/permissions.models';
import { AuditStore } from '../stores/permissions.store';

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

@Component({
  selector: 'app-audit-page',
  imports: [TranslocoPipe, ListPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-list-page
      [title]="'audit.title' | transloco"
      [rows]="store.rows()"
      [columns]="columns"
      [total]="store.total()"
      [query]="store.query()"
      [loading]="store.loading()"
      [loadError]="loadError()"
      (queryChange)="onQuery($event)"
      (retry)="reload()" />
  `,
})
export class AuditPage implements OnInit {
  protected readonly store = inject(AuditStore);
  private readonly i18n = inject(TranslocoService);

  protected readonly loadError = signal<string | null>(null);

  protected readonly columns: TableColumn<AuditEntry>[] = [
    { key: 'at', header: this.i18n.translate('audit.when'), sortable: true, cell: (r) => when(r.at) },
    { key: 'actor', header: this.i18n.translate('audit.actor'), sortable: true },
    { key: 'action', header: this.i18n.translate('audit.action'), cell: (r) => this.i18n.translate('audit.actions.' + r.action) },
    { key: 'target', header: this.i18n.translate('audit.target'), sortable: true },
    { key: 'detail', header: this.i18n.translate('audit.detail') },
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
}
