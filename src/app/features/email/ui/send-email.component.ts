import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { EmailService } from '../services/email.service';

/** "Email bhejo" button + chhota form (invoice / statement / repair ready). */
@Component({
  selector: 'app-send-email',
  imports: [FormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!open()) {
      <button type="button" [class]="ui.btn" (click)="start()">{{ 'emailPage.send' | transloco }}</button>
    } @else {
      <span class="inline-flex flex-wrap items-center gap-1">
        <input type="email" dir="ltr" class="min-h-11 w-56 rounded-lg border border-slate-400 bg-transparent px-2 text-sm"
          [attr.aria-label]="'emailPage.to' | transloco" [placeholder]="'emailPage.to' | transloco" [(ngModel)]="to" />
        <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="send()">{{ 'emailPage.sendNow' | transloco }}</button>
        <button type="button" [class]="ui.btn" (click)="open.set(false)">{{ 'common.cancel' | transloco }}</button>
      </span>
    }
    @if (msg(); as m) { <span role="status" class="ms-2 text-sm" [class.text-red-600]="!ok()" [class.text-green-700]="ok()">{{ m }}</span> }
  `,
})
export class SendEmailComponent {
  private readonly api = inject(EmailService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  readonly kind = input.required<'invoice' | 'statement' | 'repair'>();
  readonly refId = input.required<number>();
  readonly defaultTo = input<string>('');
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly msg = signal<string | null>(null);
  protected readonly ok = signal(true);
  protected to = '';

  protected start(): void {
    this.to = this.defaultTo();
    this.msg.set(null);
    this.open.set(true);
  }

  protected async send(): Promise<void> {
    this.busy.set(true);
    try {
      const to = this.to.trim() || null;
      const id = this.refId();
      const req = this.kind() === 'invoice' ? this.api.sendInvoice(id, to) : this.kind() === 'statement' ? this.api.sendStatement(id, to) : this.api.sendRepairReady(id, to);
      await firstValueFrom(req);
      this.ok.set(true);
      this.msg.set(this.i18n.translate('emailPage.sentTo', { to: to ?? '' }));
      this.open.set(false);
    } catch (e) {
      this.ok.set(false);
      this.msg.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}
