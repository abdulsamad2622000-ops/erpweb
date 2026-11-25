import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ScanEvent, ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { WarrantyCheck } from '../models/repair.models';
import { RepairsService } from '../services/repairs.service';
import { newKey } from '../../sales/utils/sales-print';
import { WARRANTY_TONE } from '../utils/repair-utils';

/** Nayi job card: serial scan -> warranty check -> customer/device/problem. */
@Component({
  selector: 'app-repair-new-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, ScanInputComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'repairsPage.add' | transloco }}</h1>
        <a routerLink="/warranty" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
      </div>
      <div [class]="ui.card + ' space-y-2'">
        <label for="rn-scan" class="block text-sm font-medium">{{ 'repairsPage.scanSerial' | transloco }}</label>
        <app-scan-input inputId="rn-scan" [placeholder]="'repairsPage.scanHint' | transloco" (scanned)="onScan($event)" />
        @if (w(); as w) {
          <div class="space-y-1 text-sm" role="status">
            <app-status-badge [label]="'repairsPage.w.' + w.warranty | transloco" [tone]="wTone[w.warranty]" />
            <code dir="ltr" class="ms-2">{{ w.serial }}</code> · {{ w.productName ?? '—' }}
            @if (w.sale) {
              <p>{{ 'repairsPage.soldOn' | transloco: { number: w.sale.number, date: w.sale.date } }}
                @if (w.warrantyUntil) { · {{ 'repairsPage.until' | transloco: { date: w.warrantyUntil } }} }</p>
            }
            @if (w.openJob) { <p class="text-red-600">{{ 'repairsPage.hasOpen' | transloco: { number: w.openJob } }}</p> }
          </div>
        }
      </div>
      <div [class]="ui.card + ' grid gap-3 sm:grid-cols-2'">
        <label class="text-sm font-medium sm:col-span-2">{{ 'repairsPage.device' | transloco }}
          <input [class]="ui.input + ' mt-1'" [(ngModel)]="device" [placeholder]="w()?.productName ?? ''" /></label>
        <label class="text-sm font-medium">{{ 'customersPage.name' | transloco }}
          <input [class]="ui.input + ' mt-1'" [(ngModel)]="name" /></label>
        <label class="text-sm font-medium">{{ 'customersPage.phone' | transloco }}
          <input type="tel" dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="phone" /></label>
        <label class="text-sm font-medium sm:col-span-2">{{ 'repairsPage.problem' | transloco }}
          <textarea rows="3" [class]="ui.input + ' mt-1 py-2'" [(ngModel)]="problem"></textarea></label>
        <label class="text-sm font-medium sm:col-span-2">{{ 'repairsPage.accessories' | transloco }}
          <input [class]="ui.input + ' mt-1'" [(ngModel)]="accessories" [placeholder]="'repairsPage.accessoriesHint' | transloco" /></label>
        <label class="text-sm font-medium">{{ 'repairsPage.estimate' | transloco }}
          <input type="number" min="0" [class]="ui.input + ' mt-1'" [(ngModel)]="estimate" /></label>
        <label class="text-sm font-medium">{{ 'repairsPage.promised' | transloco }}
          <input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="promisedOn" /></label>
        @if (error(); as e) { <p role="alert" class="text-sm text-red-600 sm:col-span-2">{{ e }}</p> }
        <div class="flex justify-end sm:col-span-2">
          <button type="button" [class]="ui.primary" [disabled]="busy() || !!w()?.openJob || problem.trim().length < 5" (click)="save()">
            {{ 'repairsPage.create' | transloco }}
          </button>
        </div>
      </div>
    </section>
  `,
})
export class RepairNewPage {
  private readonly api = inject(RepairsService);
  private readonly i18n = inject(TranslocoService);
  private readonly router = inject(Router);
  protected readonly ui = UI;
  protected readonly wTone = WARRANTY_TONE;
  protected readonly w = signal<WarrantyCheck | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected device = '';
  protected name = '';
  protected phone = '';
  protected problem = '';
  protected accessories = '';
  protected estimate: number | null = null;
  protected promisedOn = '';
  private readonly key = newKey();

  protected async onScan(e: ScanEvent): Promise<void> {
    this.error.set(null);
    try {
      const w = await firstValueFrom(this.api.check(e.value));
      this.w.set(w);
      if (w.productName && !this.device) this.device = w.productName;
      if (w.customer) {
        this.name = w.customer.name;
        this.phone = w.customer.phone;
      }
    } catch (err) {
      this.error.set(errorMessage(err, this.i18n.translate('errors.generic')));
    }
  }

  protected async save(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const w = this.w();
    try {
      const j = await firstValueFrom(this.api.create({
        serial: w?.serial ?? null, device: this.device.trim() || null, customerId: null,
        customerName: this.name.trim() || null, customerPhone: this.phone.trim() || null, problem: this.problem.trim(),
        accessories: this.accessories.trim(), estimate: this.estimate === null || (this.estimate as unknown) === '' ? null : +this.estimate,
        promisedOn: this.promisedOn || null,
      }, this.key));
      await this.router.navigate(['/warranty', j.id], { queryParams: { print: 1 } });
    } catch (err) {
      this.error.set(errorMessage(err, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}
