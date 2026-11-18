import { Injectable, signal } from '@angular/core';

export interface ApprovalRequestOptions {
  /** Jis action ki approval maangi ja rahi hai, jaise "Void sale #42". */
  action: string;
  /** Default 5 */
  minLength?: number;
}

export interface ApprovalRequestResult {
  reason: string;
}

export interface PendingApproval extends ApprovalRequestOptions {
  minLength: number;
  resolve: (result: ApprovalRequestResult | null) => void;
}

@Injectable({ providedIn: 'root' })
export class ApprovalRequestDialogService {
  private readonly _pending = signal<PendingApproval | null>(null);
  readonly pending = this._pending.asReadonly();

  /** { reason } ya cancel par null. API call yahan nahi hoti, wo caller karega. */
  request(options: ApprovalRequestOptions): Promise<ApprovalRequestResult | null> {
    this._pending()?.resolve(null);
    return new Promise<ApprovalRequestResult | null>((resolve) => {
      this._pending.set({ ...options, minLength: options.minLength ?? 5, resolve });
    });
  }

  answer(reason: string | null): void {
    const current = this._pending();
    if (!current) return;
    this._pending.set(null);
    current.resolve(reason === null ? null : { reason });
  }
}