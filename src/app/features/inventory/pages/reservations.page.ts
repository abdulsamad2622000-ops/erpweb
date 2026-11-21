import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Reservation } from '../models/reservation.models';
import { ReservationsService } from '../services/reservations.service';
import { RESERVATION_TONE } from '../utils/reservation-utils';

@Component({
  selector: 'app-reservations-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'reservationsPage.title' | transloco }}</h1>
        @if (auth.can('inventory.reservation.create')) {
          <a routerLink="/inventory/reservations/new" [class]="ui.primary">{{ 'reservationsPage.add' | transloco }}</a>
        }
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'reservationsPage.hint' | transloco }}</p>

      @if (actionError(); as e) {
        <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p>
      }

      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[46rem] text-start text-sm">
          <caption class="sr-only">{{ 'reservationsPage.title' | transloco }}</caption>
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'reservationsPage.number' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'reservationsPage.customer' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'reservationsPage.serials' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'reservationsPage.holdUntil' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'common.actions' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (r of rows(); track r.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><span class="font-medium">{{ r.number }}</span></td>
                  <td [class]="ui.td">
                    {{ r.customerName }}
                    @if (r.note) { <br /><span class="text-xs text-slate-600 dark:text-slate-400">{{ r.note }}</span> }
                  </td>
                  <td [class]="ui.td">
                    <details>
                      <summary class="min-h-11 cursor-pointer py-2">{{ 'reservationsPage.serialsCount' | transloco: { count: r.lines.length } }}</summary>
                      <ul class="space-y-1 pb-2">
                        @for (l of r.lines; track l.serial) {
                          <li><code dir="ltr">{{ l.serial }}</code> <span class="text-xs text-slate-600 dark:text-slate-400">{{ l.name }}</span></li>
                        }
                      </ul>
                    </details>
                  </td>
                  <td [class]="ui.td">{{ r.holdUntil ?? ('reservationsPage.noHold' | transloco) }}</td>
                  <td [class]="ui.td"><app-status-badge [label]="'reservationsPage.status.' + r.status | transloco" [tone]="tone[r.status]" /></td>
                  <td [class]="ui.td + ' text-end'">
                    @if (r.status === 'active' && auth.can('inventory.reservation.create')) {
                      <button type="button" [class]="ui.danger" [disabled]="busyId() === r.id" (click)="release(r)">
                        {{ 'reservationsPage.release' | transloco }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'reservationsPage.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class ReservationsPage implements OnInit {
  private readonly api = inject(ReservationsService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly i18n = inject(TranslocoService);
  protected readonly auth = inject(AuthStore);
  protected readonly ui = UI;
  protected readonly tone = RESERVATION_TONE;

  protected readonly rows = signal<Reservation[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await firstValueFrom(this.api.list()));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async release(r: Reservation): Promise<void> {
    const yes = await this.confirm.confirm({
      title: this.i18n.translate('reservationsPage.releaseTitle'),
      message: this.i18n.translate('reservationsPage.releaseMessage'),
      confirmLabel: this.i18n.translate('reservationsPage.release'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (!yes) return;
    this.actionError.set(null);
    this.busyId.set(r.id);
    try {
      await firstValueFrom(this.api.release(r.id));
      await this.load();
    } catch (e) {
      this.actionError.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busyId.set(null);
    }
  }
}