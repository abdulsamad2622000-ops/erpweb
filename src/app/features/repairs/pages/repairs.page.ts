import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { JOB_STATUSES, RepairJob } from '../models/repair.models';
import { RepairsService } from '../services/repairs.service';
import { JOB_TONE, WARRANTY_TONE } from '../utils/repair-utils';

/** Step 14: warranty / repair job cards ki list. */
@Component({
  selector: 'app-repairs-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'repairsPage.title' | transloco }}</h1>
        <a *hasPermission="'warranty.claim.create'" routerLink="new" [class]="ui.primary">+ {{ 'repairsPage.add' | transloco }}</a>
      </div>
      <div class="flex flex-wrap gap-2">
        <input #q [class]="ui.input + ' max-w-xs'" [attr.aria-label]="'common.search' | transloco"
          [placeholder]="'repairsPage.searchHint' | transloco" (input)="search(q.value)" />
        <select [class]="ui.input + ' max-w-56'" [attr.aria-label]="'common.status' | transloco" [(ngModel)]="status" (ngModelChange)="reload()">
          <option value="open">{{ 'repairsPage.openOnly' | transloco }}</option>
          <option value="">{{ 'salesDocs.all' | transloco }}</option>
          @for (s of statuses; track s) { <option [value]="s">{{ 'repairsPage.status.' + s | transloco }}</option> }
        </select>
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[52rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'repairsPage.job' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'repairsPage.device' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'salesDocs.customer' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'repairsPage.warranty' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'repairsPage.promised' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'repairsPage.charges' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'common.status' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (j of rows(); track j.id) {
              <tr [class]="ui.tr">
                <td [class]="ui.td"><a [routerLink]="[j.id]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300">{{ j.number }}</a>
                  <div class="text-xs text-slate-600 dark:text-slate-400">{{ j.createdAt.slice(0, 10) }}</div></td>
                <td [class]="ui.td">{{ j.device }} @if (j.serial) { <div class="text-xs"><code dir="ltr">{{ j.serial }}</code></div> }</td>
                <td [class]="ui.td">{{ j.customerName }} <div class="text-xs" dir="ltr">{{ j.customerPhone }}</div></td>
                <td [class]="ui.td"><app-status-badge [label]="'repairsPage.w.' + j.warranty | transloco" [tone]="wTone[j.warranty]" /></td>
                <td [class]="ui.td">{{ j.promisedOn ?? '—' }}</td>
                <td [class]="ui.td + ' text-end'">{{ j.total ? fmt(j.total) : '' }}</td>
                <td [class]="ui.td"><app-status-badge [label]="'repairsPage.status.' + j.status | transloco" [tone]="tone[j.status]" /></td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (total() > rows().length) {
        <div class="flex justify-center"><button type="button" [class]="ui.btn" (click)="more()">{{ 'salesDocs.more' | transloco }}</button></div>
      }
    </section>
  `,
})
export class RepairsPage implements OnInit {
  private readonly api = inject(RepairsService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = JOB_TONE;
  protected readonly wTone = WARRANTY_TONE;
  protected readonly statuses = JOB_STATUSES;
  protected readonly rows = signal<RepairJob[]>([]);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  protected status = 'open';
  private text = '';
  private page = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.reload();
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected search(v: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.text = v.trim();
      void this.reload();
    }, 250);
  }

  protected async reload(): Promise<void> {
    this.page = 1;
    this.rows.set([]);
    await this.fetch();
  }

  protected async more(): Promise<void> {
    this.page++;
    await this.fetch();
  }

  private async fetch(): Promise<void> {
    try {
      const r = await firstValueFrom(this.api.list({ page: this.page, pageSize: 20, search: this.text, status: this.status }));
      this.rows.update((x) => [...x, ...r.data]);
      this.total.set(r.total);
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }
}
