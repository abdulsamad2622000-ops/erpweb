import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ReasonOptions extends ConfirmOptions {
  /** Reason ke trimmed characters ki kam az kam tadaad. Default 10. */
  minLength?: number;
}

export type ApprovalOptions = ConfirmOptions;

export interface ApprovalResult {
  note: string;
}

export type DialogKind = 'confirm' | 'reason' | 'approval';

export const DEFAULT_REASON_MIN_LENGTH = 10;

export interface PendingDialog extends ConfirmOptions {
  kind: DialogKind;
  minLength: number;
  finish: (ok: boolean, text: string) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _pending = signal<PendingDialog | null>(null);
  readonly pending = this._pending.asReadonly();

  /** Sada haan/nahi. */
  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.open('confirm', options, 0, (ok) => resolve(ok));
    });
  }

  /** Wajah likhna zaroori. Cancel par null, warna trimmed text. */
  reason(options: ReasonOptions): Promise<string | null> {
    const minLength = options.minLength ?? DEFAULT_REASON_MIN_LENGTH;
    return new Promise<string | null>((resolve) => {
      this.open('reason', options, minLength, (ok, text) => resolve(ok ? text.trim() : null));
    });
  }

  /** Approval: note aur "I approve" checkbox. Asli approval backend permission se hoti hai. */
  approve(options: ApprovalOptions): Promise<ApprovalResult | null> {
    return new Promise<ApprovalResult | null>((resolve) => {
      this.open('approval', options, 0, (ok, text) => resolve(ok ? { note: text.trim() } : null));
    });
  }

  /** Dialog band karta hai. ok=false cancel hai. */
  answer(ok: boolean, text = ''): void {
    const current = this._pending();
    if (!current) return;
    this._pending.set(null);
    current.finish(ok, text);
  }

  private open(
    kind: DialogKind,
    options: ConfirmOptions,
    minLength: number,
    finish: (ok: boolean, text: string) => void,
  ): void {
    // Pehle se koi dialog khula ho to usay cancel kar do.
    this._pending()?.finish(false, '');
    this._pending.set({ ...options, kind, minLength, finish });
  }
}