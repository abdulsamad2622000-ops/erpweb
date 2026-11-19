import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import {
  BackupInfo,
  CompanyProfile,
  CostingSettings,
  NumberSeries,
  NumberSeriesInput,
  PriceTier,
  PriceTierInput,
} from '../models/settings.models';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/settings`;

  getCompany(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfile>(`${this.base}/company`);
  }
  saveCompany(body: CompanyProfile): Observable<CompanyProfile> {
    return this.http.put<CompanyProfile>(`${this.base}/company`, body);
  }

  listSeries(): Observable<NumberSeries[]> {
    return this.http.get<NumberSeries[]>(`${this.base}/number-series`);
  }
  saveSeries(id: number, body: NumberSeriesInput): Observable<NumberSeries> {
    return this.http.put<NumberSeries>(`${this.base}/number-series/${id}`, body);
  }

  listTiers(): Observable<PriceTier[]> {
    return this.http.get<PriceTier[]>(`${this.base}/price-tiers`);
  }
  saveTier(id: number, body: PriceTierInput): Observable<PriceTier> {
    return this.http.put<PriceTier>(`${this.base}/price-tiers/${id}`, body);
  }

  getCosting(): Observable<CostingSettings> {
    return this.http.get<CostingSettings>(`${this.base}/costing`);
  }
  saveCosting(body: CostingSettings): Observable<CostingSettings> {
    return this.http.put<CostingSettings>(`${this.base}/costing`, body);
  }

  getBackup(): Observable<BackupInfo> {
    return this.http.get<BackupInfo>(`${this.base}/backup`);
  }
}