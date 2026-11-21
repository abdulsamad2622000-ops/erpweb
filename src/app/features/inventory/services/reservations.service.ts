import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { Reservation, ReservationInput } from '../models/reservation.models';

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${APP_CONFIG.apiBase}/inventory/reservations`;

  list(): Observable<Reservation[]> {
    return this.http.get<Reservation[]>(this.base);
  }

  create(body: ReservationInput): Observable<Reservation> {
    return this.http.post<Reservation>(this.base, body);
  }

  release(id: number): Observable<Reservation> {
    return this.http.post<Reservation>(`${this.base}/${id}/release`, {});
  }
}