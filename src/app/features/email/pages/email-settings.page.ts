import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { EmailTemplate, EmailTrigger, ScheduledReport, SmtpInput } from '../models/email.models';
import { EmailService } from '../services/email.service';

type Tab = 'smtp' | 'triggers' | 'schedules';

/** Step 16: SMTP settings, event trigger matrix, scheduled reports. */
@Component({
  selector: 'app-email-settings-page',
  imports: [FormsModule, RouterLink, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">Email settings</h1>
        <a routerLink="/email" [class]="ui.btn">Back to templates and log</a>
      </div>
      <div class="flex flex-wrap gap-1" role="tablist" aria-label="Email settings">
        @for (t of tabs; track t.id) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" class="min-h-11 rounded-lg border px-4 text-sm"
            [class]="tab() === t.id ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white' : 'border-slate-400'" (click)="setTab(t.id)">{{ t.label }}</button>
        }
      </div>
      @if (loading()) { <p role="status" class="text-sm">Loading...</p> }
      @if (error(); as e) { <p role="alert" class="text-sm text-red-700">{{ e }}</p> }
      @if (notice(); as n) { <p role="status" class="text-sm" [class.text-red-700]="!ok()" [class.text-green-700]="ok()">{{ n }}</p> }

      @if (tab() === 'smtp') {
        <div [class]="ui.card + ' space-y-3'">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="block text-sm font-medium">Host<input placeholder="Type here..." dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="smtp.host" /></label>
            <label class="block text-sm font-medium">Port<input placeholder="Type here..." type="number" dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="smtp.port" /></label>
            <label class="block text-sm font-medium">Encryption
              <select [class]="ui.input + ' mt-1'" [(ngModel)]="smtp.encryption">
                <option value="tls">TLS (STARTTLS)</option><option value="ssl">SSL</option><option value="none">None</option>
              </select></label>
            <label class="block text-sm font-medium">Username<input placeholder="Type here..." dir="ltr" autocomplete="off" [class]="ui.input + ' mt-1'" [(ngModel)]="smtp.username" /></label>
            <label class="block text-sm font-medium">Password
              <input type="password" autocomplete="new-password" [class]="ui.input + ' mt-1'" [(ngModel)]="password"
                [placeholder]="hasPassword() ? 'Saved. Leave empty to keep it.' : 'Not set'" /></label>
            <label class="block text-sm font-medium">From name<input placeholder="Type here..." [class]="ui.input + ' mt-1'" [(ngModel)]="smtp.fromName" /></label>
            <label class="block text-sm font-medium">From email<input placeholder="Type here..." type="email" dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="smtp.fromEmail" /></label>
          </div>
          <p class="text-xs text-slate-600">The password is encrypted on the server and is never shown again.</p>
          <div class="flex flex-wrap items-end justify-between gap-2" *hasPermission="'email.template.edit'">
            <div class="flex flex-wrap items-end gap-2">
              <label class="text-sm font-medium">Send a test to
                <input placeholder="Type here..." type="email" dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="testTo" /></label>
              <button type="button" [class]="ui.btn" [disabled]="busy() || !testTo.trim()" (click)="testSmtp()">Send test email</button>
            </div>
            <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="saveSmtp()">Save</button>
          </div>
        </div>
      }

      @if (tab() === 'triggers') {
        <div [class]="ui.tableWrap"><table class="w-full min-w-[40rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">Event</th><th scope="col" [class]="ui.th">Recipients</th>
            <th scope="col" [class]="ui.th">Template</th><th scope="col" [class]="ui.th">On</th>
          </tr></thead>
          <tbody>
            @for (t of triggers(); track t.event) {
              <tr [class]="ui.tr"><td [class]="ui.td">{{ t.label }}</td>
                <td [class]="ui.td"><select [class]="ui.input" [attr.aria-label]="t.label + ' recipients'" [(ngModel)]="t.recipients">
                  <option value="customer">Customer</option><option value="staff">Staff</option><option value="both">Both</option></select></td>
                <td [class]="ui.td"><select [class]="ui.input" [attr.aria-label]="t.label + ' template'" [(ngModel)]="t.templateKey">
                  @for (tp of templates(); track tp.key) { <option [value]="tp.key">{{ tp.name }}</option> }</select></td>
                <td [class]="ui.td"><input type="checkbox" class="h-5 w-5" [attr.aria-label]="t.label + ' on or off'" [(ngModel)]="t.enabled" /></td></tr>
            } @empty { <tr><td colspan="4" class="px-4 py-6 text-center text-slate-600">No events.</td></tr> }
          </tbody>
        </table></div>
        <div *hasPermission="'email.template.edit'"><button type="button" [class]="ui.primary" [disabled]="busy()" (click)="saveTriggers()">Save</button></div>
      }

      @if (tab() === 'schedules') {
        <div [class]="ui.tableWrap"><table class="w-full min-w-[44rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">Report</th><th scope="col" [class]="ui.th">How often</th>
            <th scope="col" [class]="ui.th">Send to</th><th scope="col" [class]="ui.th">On</th><th scope="col" [class]="ui.th"><span class="sr-only">Remove</span></th>
          </tr></thead>
          <tbody>
            @for (s of schedules(); track $index) {
              <tr [class]="ui.tr">
                <td [class]="ui.td"><select [class]="ui.input" aria-label="Report" [(ngModel)]="s.report">
                  <option value="sales">Sales and profit</option><option value="stock">Stock value</option>
                  <option value="receivables">Receivables</option><option value="purchases">Purchases</option></select></td>
                <td [class]="ui.td"><select [class]="ui.input" aria-label="How often" [(ngModel)]="s.frequency">
                  <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></td>
                <td [class]="ui.td"><input placeholder="Type here..." type="email" dir="ltr" aria-label="Send to" [class]="ui.input" [(ngModel)]="s.recipients" /></td>
                <td [class]="ui.td"><input type="checkbox" class="h-5 w-5" aria-label="On or off" [(ngModel)]="s.enabled" /></td>
                <td [class]="ui.td"><button type="button" [class]="ui.btn" (click)="removeSchedule($index)" aria-label="Remove schedule"><i class="pi pi-trash" aria-hidden="true"></i></button></td>
              </tr>
            } @empty { <tr><td colspan="5" class="px-4 py-6 text-center text-slate-600">No scheduled reports.</td></tr> }
          </tbody>
        </table></div>
        <div class="flex flex-wrap gap-2" *hasPermission="'email.template.edit'">
          <button type="button" [class]="ui.btn" (click)="addSchedule()">Add schedule</button>
          <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="saveSchedules()">Save</button>
        </div>
      }
    </section>
  `,
})
export class EmailSettingsPage implements OnInit {
  private readonly api = inject(EmailService);
  protected readonly ui = UI;
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'smtp', label: 'SMTP' }, { id: 'triggers', label: 'Triggers' }, { id: 'schedules', label: 'Scheduled reports' },
  ];
  protected readonly tab = signal<Tab>('smtp');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected readonly hasPassword = signal(false);
  protected readonly templates = signal<EmailTemplate[]>([]);
  protected readonly triggers = signal<EmailTrigger[]>([]);
  protected readonly schedules = signal<ScheduledReport[]>([]);
  protected smtp: SmtpInput = { host: '', port: 587, encryption: 'tls', username: '', fromName: '', fromEmail: '' };
  protected password = '';
  protected testTo = '';

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [s, tr, sc, tp] = await Promise.all([
        firstValueFrom(this.api.smtp()), firstValueFrom(this.api.triggers()),
        firstValueFrom(this.api.schedules()), firstValueFrom(this.api.templates()),
      ]);
      const { hasPassword, ...rest } = s;
      this.smtp = rest;
      this.hasPassword.set(hasPassword);
      this.triggers.set(tr.map((t) => ({ ...t })));
      this.schedules.set(sc.map((x) => ({ ...x })));
      this.templates.set(tp.templates);
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, 'Something went wrong.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    this.notice.set(null);
  }

  private async run(fn: () => Promise<string>): Promise<void> {
    this.busy.set(true);
    try {
      this.notice.set(await fn());
      this.ok.set(true);
    } catch (e) {
      this.notice.set(errorMessage(e, 'Something went wrong.'));
      this.ok.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  protected async saveSmtp(): Promise<void> {
    await this.run(async () => {
      const body: SmtpInput = this.password ? { ...this.smtp, password: this.password } : { ...this.smtp };
      const saved = await firstValueFrom(this.api.saveSmtp(body));
      this.hasPassword.set(saved.hasPassword);
      this.password = '';
      return 'SMTP settings saved.';
    });
  }

  protected async testSmtp(): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.testSmtp(this.testTo.trim()));
      return `Test email sent to ${this.testTo.trim()}.`;
    });
  }

  protected async saveTriggers(): Promise<void> {
    await this.run(async () => {
      this.triggers.set((await firstValueFrom(this.api.saveTriggers(this.triggers()))).map((t) => ({ ...t })));
      return 'Triggers saved.';
    });
  }

  protected addSchedule(): void {
    this.schedules.update((l) => [...l, { id: 0, report: 'sales', frequency: 'daily', recipients: '', enabled: true }]);
  }

  protected removeSchedule(i: number): void {
    this.schedules.update((l) => l.filter((_, idx) => idx !== i));
  }

  protected async saveSchedules(): Promise<void> {
    await this.run(async () => {
      this.schedules.set((await firstValueFrom(this.api.saveSchedules(this.schedules()))).map((x) => ({ ...x })));
      return 'Scheduled reports saved.';
    });
  }
}
