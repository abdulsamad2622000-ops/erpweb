import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { BadgeTone, StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { CLAIM_FLOW, ClaimStatus, SupplierClaim } from '../models/claim.models';
import { ClaimsService } from '../services/claims.service';

const TONE: Record<ClaimStatus, BadgeTone> = { open: 'neutral', sent: 'info', approved: 'success', rejected: 'danger', credited: 'success' };
const LABEL: Record<ClaimStatus, string> = { open: 'Open', sent: 'Sent to supplier', approved: 'Approved', rejected: 'Rejected', credited: 'Credited' };

/** Step 14: supplier ko bheje gaye warranty claims. */
@Component({
  selector: 'app-supplier-claims-page',
  imports: [FormsModule, HasPermissionDirective, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      <h1 class="text-xl font-semibold">Supplier warranty claims</h1>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-700">{{ e }}</p> }
      @if (notice(); as n) { <p role="status" class="text-sm text-green-700">{{ n }}</p> }

      <form *hasPermission="'warranty.claim.create'" [class]="ui.card + ' grid gap-3 sm:grid-cols-3'" (ngSubmit)="create()">
        <label class="block text-sm font-medium">Serial number<input placeholder="Enter serial..." name="serial" dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="serial" /></label>
        <label class="block text-sm font-medium">Supplier<input placeholder="Enter supplier..." name="supplier" [class]="ui.input + ' mt-1'" [(ngModel)]="supplier" /></label>
        <label class="block text-sm font-medium sm:col-span-3">Reason (at least 10 characters)
          <textarea placeholder="Enter reason..." name="reason" rows="2" [class]="ui.input + ' mt-1 py-2'" [(ngModel)]="reason"></textarea></label>
        <div class="sm:col-span-3"><button type="submit" [class]="ui.primary" [disabled]="busy() || !serial.trim() || !supplier.trim() || reason.trim().length < 10">Create claim</button></div>
      </form>

      @if (loading()) { <p role="status" class="text-sm">Loading...</p> }
      <div [class]="ui.tableWrap"><table class="w-full min-w-[44rem] text-sm">
        <thead [class]="ui.thead"><tr>
          <th scope="col" [class]="ui.th">Claim</th><th scope="col" [class]="ui.th">Serial</th><th scope="col" [class]="ui.th">Supplier</th>
          <th scope="col" [class]="ui.th">Reason</th><th scope="col" [class]="ui.th">Status</th><th scope="col" [class]="ui.th">Action</th>
        </tr></thead>
        <tbody>
          @for (c of claims(); track c.id) {
            <tr [class]="ui.tr">
              <td [class]="ui.td">{{ c.number }}<div class="text-xs text-slate-600">{{ c.createdAt.slice(0, 10) }}</div></td>
              <td [class]="ui.td" dir="ltr">{{ c.serial }}</td><td [class]="ui.td">{{ c.supplier }}</td><td [class]="ui.td">{{ c.reason }}</td>
              <td [class]="ui.td"><app-status-badge [label]="label(c.status)" [tone]="tone(c.status)" /></td>
              <td [class]="ui.td">
                <span *hasPermission="'warranty.claim.edit'" class="flex flex-wrap gap-1">
                  @for (n of next(c.status); track n) {
                    <button type="button" [class]="ui.btn" [disabled]="busy()" (click)="move(c, n)">{{ label(n) }}</button>
                  }
                </span>
              </td>
            </tr>
          } @empty { <tr><td colspan="6" class="px-4 py-6 text-center text-slate-600">No claims yet.</td></tr> }
        </tbody>
      </table></div>
    </section>
  `,
})
export class SupplierClaimsPage implements OnInit {
  private readonly api = inject(ClaimsService);
  protected readonly ui = UI;
  protected readonly claims = signal<SupplierClaim[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected serial = '';
  protected supplier = '';
  protected reason = '';

  ngOnInit(): void { void this.load(); }
  protected tone(s: ClaimStatus): BadgeTone { return TONE[s]; }
  protected label(s: ClaimStatus): string { return LABEL[s]; }
  protected next(s: ClaimStatus): ClaimStatus[] { return CLAIM_FLOW[s]; }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.claims.set((await firstValueFrom(this.api.list({ pageSize: 100 }))).data);
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, 'Something went wrong.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async run(fn: () => Promise<string>): Promise<void> {
    this.busy.set(true);
    this.notice.set(null);
    try {
      this.notice.set(await fn());
      this.error.set(null);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e, 'Something went wrong.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async create(): Promise<void> {
    await this.run(async () => {
      const c = await firstValueFrom(this.api.create({ serial: this.serial.trim(), supplier: this.supplier.trim(), reason: this.reason.trim() }));
      this.serial = '';
      this.supplier = '';
      this.reason = '';
      return `Claim ${c.number} created.`;
    });
  }

  protected async move(c: SupplierClaim, s: ClaimStatus): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.api.move(c.id, s, null));
      return `${c.number}: ${LABEL[s]}.`;
    });
  }
}
