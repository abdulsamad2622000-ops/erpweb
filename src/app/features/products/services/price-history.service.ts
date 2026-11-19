import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { PriceTierCode } from '../../settings/models/settings.models';

export interface ProductPriceChange {
  id: number;
  productId: number;
  tier: PriceTierCode;
  /** null = pehli dafa price set hui. */
  oldPrice: number | null;
  newPrice: number | null;
  changedAt: string;
  changedBy: string;
}

@Injectable({ providedIn: 'root' })
export class ProductPriceHistoryService {
  private readonly http = inject(HttpClient);

  list(productId: number): Observable<ProductPriceChange[]> {
    return this.http.get<ProductPriceChange[]>(`${APP_CONFIG.apiBase}/products/${productId}/history`);
  }
}