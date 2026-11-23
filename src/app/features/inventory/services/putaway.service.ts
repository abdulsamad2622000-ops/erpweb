import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { PutawayInput, PutawayResult } from '../models/putaway.models';

@Injectable({ providedIn: 'root' })
export class PutawayService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/inventory/putaway`;

  putaway(body: PutawayInput): Observable<PutawayResult> {
    return this.http.post<PutawayResult>(this.base, body);
  }
}