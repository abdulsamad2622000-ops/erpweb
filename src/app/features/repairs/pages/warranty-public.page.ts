import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { PublicWarranty } from '../models/claim.models';
import { ClaimsService } from '../services/claims.service';

/** Public page (login nahi chahiye): serial se warranty dekhna. Customer ki detail nahi dikhti. */
@Component({
  selector: 'app-warranty-public-page',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-4">
      <h1 class="text-2xl font-semibold">Check your warranty</h1>
      <form class="space-y-3 rounded-xl border border-slate-300 p-4" (ngSubmit)="check()">
        <label for="wc-serial" class="block text-sm font-medium">Serial number</label>
        <input placeholder="Enter wc serial..." id="wc-serial" name="serial" dir="ltr" autocomplete="off" class="min-h-11 w-full rounded-lg border border-slate-400 px-3" [(ngModel)]="serial" />
        <button type="submit" class="min-h-12 w-full rounded-lg bg-[#2563EB] px-5 font-medium text-white disabled:opacity-50" [disabled]="busy() || !serial.trim()">Check</button>
      </form>
      @if (busy()) { <p role="status" class="text-sm">Checking...</p> }
      @if (error(); as e) { <p role="alert" class="text-sm text-red-700">{{ e }}</p> }
      @if (result(); as r) {
        <div role="status" class="space-y-1 rounded-xl border border-slate-300 p-4 text-sm">
          <p><b>Serial:</b> <span dir="ltr">{{ r.serial }}</span></p>
          <p><b>Product:</b> {{ r.productName }}</p>
          @if (r.warranty === 'in_warranty') {
            <p class="font-semibold text-green-700">In warranty until {{ r.warrantyUntil }}</p>
          } @else if (r.warranty === 'expired') {
            <p class="font-semibold text-amber-800">Warranty ended on {{ r.warrantyUntil }}</p>
          } @else {
            <p class="font-semibold">This serial was not sold by us.</p>
          }
        </div>
      }
    </main>
  `,
})
export class WarrantyPublicPage {
  private readonly api = inject(ClaimsService);
  protected serial = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<PublicWarranty | null>(null);

  protected async check(): Promise<void> {
    this.busy.set(true);
    this.result.set(null);
    this.error.set(null);
    try {
      const r = await firstValueFrom(this.api.publicCheck(this.serial));
      if (!r.productName) this.error.set('We could not find this serial number.');
      else this.result.set(r);
    } catch {
      this.error.set('We could not find this serial number.');
    } finally {
      this.busy.set(false);
    }
  }
}
