import { Injectable, signal } from '@angular/core';

export interface ReasonOptions {
  title: string;
  message: string;
  /** Default 5 */
  minLength?: number;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PendingReason extends ReasonOptions {
  minLength: number;
  resolve: (result: string | null) => void;
}

@Injectable({ providedIn: 'root' })
export class ReasonDialogService {
  private readonly _pending = signal<PendingReason | null>(null);
  readonly pending = this._pending.asReadonly();

  /** Reason text (trimmed) ya cancel par null. */
  ask(options: ReasonOptions): Promise<string | null> {
    // Pehle se koi dialog khula ho to usay cancel kar do.
    this._pending()?.resolve(null);
    return new Promise<string | null>((resolve) => {
      this._pending.set({ ...options, minLength: options.minLength ?? 5, resolve });
    });
  }

  answer(result: string | null): void {
    const current = this._pending();
    if (!current) return;
    this._pending.set(null);
    current.resolve(result);
  }
}