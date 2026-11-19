import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import {
  BackupInfo,
  CompanyProfile,
  CostingSettings,
  NumberSeries,
  NumberSeriesInput,
  PriceTier,
  PriceTierInput,
} from '../models/settings.models';
import { SettingsService } from '../services/settings.service';

function messageOf(e: unknown): string {
  const err = e as { error?: { message?: string } };
  return err.error?.message ?? 'Something went wrong.';
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(SettingsService);

  readonly company = signal<CompanyProfile | null>(null);
  readonly series = signal<NumberSeries[]>([]);
  readonly tiers = signal<PriceTier[]>([]);
  readonly costing = signal<CostingSettings | null>(null);
  readonly backup = signal<BackupInfo | null>(null);
  readonly loading = signal(false);

  loadCompany(): Promise<void> {
    return this.load(this.api.getCompany(), (v) => this.company.set(v));
  }
  loadSeries(): Promise<void> {
    return this.load(this.api.listSeries(), (v) => this.series.set(v));
  }
  loadTiers(): Promise<void> {
    return this.load(this.api.listTiers(), (v) => this.tiers.set(v));
  }
  loadCosting(): Promise<void> {
    return this.load(this.api.getCosting(), (v) => this.costing.set(v));
  }
  loadBackup(): Promise<void> {
    return this.load(this.api.getBackup(), (v) => this.backup.set(v));
  }

  /** Kamyabi par null, warna error message (page dikhayega) */
  saveCompany(body: CompanyProfile): Promise<string | null> {
    return this.save(async () => this.company.set(await firstValueFrom(this.api.saveCompany(body))));
  }
  saveSeries(id: number, body: NumberSeriesInput): Promise<string | null> {
    return this.save(async () => {
      await firstValueFrom(this.api.saveSeries(id, body));
      await this.loadSeries();
    });
  }
  saveTier(id: number, body: PriceTierInput): Promise<string | null> {
    return this.save(async () => {
      await firstValueFrom(this.api.saveTier(id, body));
      await this.loadTiers();
    });
  }
  saveCosting(body: CostingSettings): Promise<string | null> {
    return this.save(async () => this.costing.set(await firstValueFrom(this.api.saveCosting(body))));
  }

  private async load<T>(req: Observable<T>, set: (v: T) => void): Promise<void> {
    this.loading.set(true);
    try {
      set(await firstValueFrom(req));
    } finally {
      this.loading.set(false);
    }
  }

  private async save(run: () => Promise<unknown>): Promise<string | null> {
    try {
      await run();
      return null;
    } catch (e) {
      return messageOf(e);
    }
  }
}