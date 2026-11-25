import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { EmailLog, EmailSettings, EmailTemplate } from '../models/email.models';
import { EmailService } from '../services/email.service';

/** Email: templates edit + test, aur bheje gaye emails ka log. */
@Component({
  selector: 'app-email-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-xl font-semibold">{{ 'emailPage.title' | transloco }}</h1><a routerLink="/email/settings" [class]="ui.btn">SMTP, triggers and schedules</a></div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-700">{{ e }}</p> }
      @if (settings(); as s) {
        <p class="text-sm" [class.text-red-700]="s.mailer === 'log' || s.mailer === 'array'">
          {{ 'emailPage.mailer' | transloco: { mailer: s.mailer, from: s.from } }}
          @if (s.mailer === 'log' || s.mailer === 'array') { {{ 'emailPage.notSetUp' | transloco }} }
        </p>
        <div class="flex flex-wrap gap-1" role="tablist" [attr.aria-label]="'emailPage.title' | transloco">
          @for (t of s.templates; track t.key) {
            <button type="button" role="tab" [attr.aria-selected]="sel()?.key === t.key" class="min-h-11 rounded-lg border px-4 text-sm"
              [class]="sel()?.key === t.key ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white' : 'border-slate-400'" (click)="pick(t)">{{ t.name }}</button>
          }
        </div>
        @if (sel(); as t) {
          <div [class]="ui.card + ' space-y-3'">
            <label class="block text-sm font-medium">{{ 'emailPage.subject' | transloco }}
              <input placeholder="Type here..." [class]="ui.input + ' mt-1'" [(ngModel)]="t.subject" /></label>
            <label class="block text-sm font-medium">{{ 'emailPage.body' | transloco }}
              <textarea placeholder="Type here..." rows="10" [class]="ui.input + ' mt-1 py-2 font-mono'" [(ngModel)]="t.body"></textarea></label>
            <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'emailPage.vars' | transloco }}
              @for (v of t.variables; track v) { <code class="me-2" dir="ltr">{{ '{{' + v + '}}' }}</code> }</p>
            <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="h-5 w-5" [(ngModel)]="t.isActive" /> {{ 'emailPage.active' | transloco }}</label>
            @if (notice(); as n) { <p role="status" class="text-sm" [class.text-red-700]="!ok()" [class.text-green-700]="ok()">{{ n }}</p> }
            <div class="flex flex-wrap items-end justify-between gap-2">
              <div class="flex flex-wrap items-end gap-2" *hasPermission="'email.template.edit'">
                <label class="text-sm font-medium">{{ 'emailPage.testTo' | transloco }}
                  <input placeholder="Type here..." type="email" dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="testTo" /></label>
                <button type="button" [class]="ui.btn" [disabled]="busy() || !testTo" (click)="test(t)">{{ 'emailPage.sendTest' | transloco }}</button>
              </div>
              <button *hasPermission="'email.template.edit'" type="button" [class]="ui.primary" [disabled]="busy() || !t.subject.trim() || !t.body.trim()" (click)="save(t)">
                {{ 'common.save' | transloco }}</button>
            </div>
          </div>
        }
      }
      <div [class]="ui.card">
        <div class="mb-2 flex items-center justify-between"><h2 class="font-semibold">{{ 'emailPage.log' | transloco }}</h2>
          <button type="button" [class]="ui.btn" (click)="loadLogs()">{{ 'common.retry' | transloco }}</button></div>
        <div class="overflow-x-auto"><table class="w-full min-w-[40rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'cashbookPage.time' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'emailPage.to' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'emailPage.subject' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'common.status' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (l of logs(); track l.id) {
              <tr [class]="ui.tr"><td [class]="ui.td">{{ l.at.slice(0, 16).replace('T', ' ') }}</td><td [class]="ui.td" dir="ltr">{{ l.to }}</td>
                <td [class]="ui.td">{{ l.subject }} @if (l.error) { <div class="text-xs text-red-700">{{ l.error }}</div> }</td>
                <td [class]="ui.td"><app-status-badge [label]="'emailPage.st.' + l.status | transloco" [tone]="l.status === 'sent' ? 'success' : 'danger'" /> @if (l.status === 'failed') { <button *hasPermission="'email.template.edit'" type="button" [class]="ui.btn + ' ms-2'" [disabled]="busy()" (click)="resend(l)">Resend</button> }</td></tr>
            } @empty { <tr><td colspan="4" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr> }
          </tbody>
        </table></div>
      </div>
    </section>
  `,
})
export class EmailPage implements OnInit {
  private readonly api = inject(EmailService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly settings = signal<EmailSettings | null>(null);
  protected readonly sel = signal<EmailTemplate | null>(null);
  protected readonly logs = signal<EmailLog[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly busy = signal(false);
  protected testTo = '';

  async ngOnInit(): Promise<void> {
    try {
      const s = await firstValueFrom(this.api.templates());
      this.settings.set(s);
      if (s.templates.length) this.pick(s.templates[0]);
    } catch (e) {
      this.error.set(this.fail(e));
    }
    await this.loadLogs();
  }

  private fail(e: unknown): string {
    return errorMessage(e, this.i18n.translate('errors.generic'));
  }

  protected pick(t: EmailTemplate): void {
    this.sel.set({ ...t });
    this.notice.set(null);
  }

  protected async resend(l: EmailLog): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.resend(l.id));
      await this.loadLogs();
      return `Email to ${l.to} sent again.`;
    });
  }

  protected async loadLogs(): Promise<void> {
    try {
      this.logs.set((await firstValueFrom(this.api.logs({ pageSize: 50 }))).data);
    } catch {
      /* log optional */
    }
  }

  private async run(fn: () => Promise<string>): Promise<void> {
    this.busy.set(true);
    try {
      this.notice.set(await fn());
      this.ok.set(true);
    } catch (e) {
      this.notice.set(this.fail(e));
      this.ok.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(t: EmailTemplate): Promise<void> {
    await this.run(async () => {
      const saved = await firstValueFrom(this.api.save(t));
      this.settings.update((s) => (s ? { ...s, templates: s.templates.map((x) => (x.key === saved.key ? saved : x)) } : s));
      return this.i18n.translate('emailPage.saved');
    });
  }

  protected async test(t: EmailTemplate): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.test(t.key, this.testTo.trim()));
      await this.loadLogs();
      return this.i18n.translate('emailPage.testSent', { to: this.testTo.trim() });
    });
    await this.loadLogs();
  }
}
