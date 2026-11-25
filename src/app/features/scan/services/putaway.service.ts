import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom, map } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { WarehouseLocation } from '../../settings/models/location.models';
import { LocationsService } from '../../settings/services/org.service';
import { PutAwayBody, PutAwayResult } from '../models/putaway.models';
import { isNetworkError } from '../utils/offline-utils';
import { OfflineCacheService } from './offline-cache.service';

@Injectable({ providedIn: 'root' })
export class PutAwayService {
  private readonly http = inject(HttpClient);
  private readonly locations = inject(LocationsService);
  private readonly cache = inject(OfflineCacheService);

  /** Bin ke barcode se bin dhoondta hai. Network band ho to pehle dekha hua bin istemal hota hai. */
  async findBin(barcode: string): Promise<WarehouseLocation | null> {
    const code = barcode.trim().toUpperCase();
    try {
      const res = await firstValueFrom(this.locations.list({ search: code, pageSize: 20 }));
      const bin =
        res.data.find((l) => l.level === 'bin' && l.isActive && (l.barcode ?? '').toUpperCase() === code) ?? null;
      if (bin) void this.cache.write(`bin:${code}`, bin);
      return bin;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      const cached = await this.cache.read<WarehouseLocation>(`bin:${code}`);
      if (cached) return cached;
      throw e;
    }
  }

  /**
   * Ek serial ko bin mein rakhta hai. Server ka contract: { binBarcode, serials[] } -> { moved, bin }.
   * Idempotency-Key se dobara bhejna mehfooz hai.
   */
  place(body: PutAwayBody, idempotencyKey: string): Observable<PutAwayResult> {
    return this.http
      .post<{ moved: number; bin: string }>(
        `${APP_CONFIG.apiBase}/inventory/putaway`,
        { binBarcode: body.bin, serials: [body.serial] },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      .pipe(
        map((r) => ({ serial: body.serial, binBarcode: r.bin, binName: r.bin, warehouseId: 0, previousBin: null })),
      );
  }
}