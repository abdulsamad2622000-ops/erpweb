import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    // Pehle se koi dialog khula ho to usay cancel kar do.
    this._pending()?.resolve(false);
    return new Promise<boolean>((resolve) => {
      this._pending.set({ ...options, resolve });
    });
  }

  answer(result: boolean): void {
    const current = this._pending();
    if (!current) return;
    this._pending.set(null);
    current.resolve(result);
  }
}
