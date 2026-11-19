import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ScanSoundService } from './scan-sound.service';
import {
  DEFAULT_MAX_KEY_GAP_MS,
  DEFAULT_MIN_SCAN_LENGTH,
  KeyBurstTracker,
  cleanScan,
} from './scan-utils';

export interface ScanEvent {
  value: string;
  /** true = tez burst (USB scanner), false = haath se type kiya. */
  scanner: boolean;
}

/**
 * USB scanner (keyboard jaisa) ya haath se code likhne ka input.
 * Enter par (scanned) deta hai, phir khali ho kar dobara focus leta hai.
 * Camera ka button sirf (cameraClick) deta hai; camera dialog alag component hai.
 */
@Component({
  selector: 'app-scan-input',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <i
          class="pi pi-qrcode pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        ></i>
        <input
          #field
          [id]="inputId()"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent ps-9 pe-3 text-sm"
          [attr.placeholder]="placeholder() || null"
          [attr.aria-label]="'common.scan.label' | transloco"
          [attr.aria-describedby]="describedBy() || null"
          [disabled]="disabled()"
          (keydown)="onKey($event)"
        />
      </div>

      @if (showCamera()) {
        <button
          type="button"
          class="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-slate-400"
          [attr.aria-label]="'common.scan.camera' | transloco"
          [disabled]="disabled()"
          (click)="cameraClick.emit()"
        >
          <i class="pi pi-camera" aria-hidden="true"></i>
        </button>
      }

      <button
        type="button"
        class="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-slate-400"
        [attr.aria-label]="(sound.muted() ? 'common.scan.unmute' : 'common.scan.mute') | transloco"
        [attr.aria-pressed]="sound.muted()"
        (click)="sound.toggle()"
      >
        <i [class]="sound.muted() ? 'pi pi-volume-off' : 'pi pi-volume-up'" aria-hidden="true"></i>
      </button>
    </div>
  `,
})
export class ScanInputComponent {
  readonly inputId = input.required<string>();
  readonly placeholder = input('');
  readonly describedBy = input('');
  readonly disabled = input(false);
  /** true ho to haath se type kiya hua code reject hota hai. */
  readonly scannerOnly = input(false);
  readonly showCamera = input(false);
  /** Scan accept hone par success beep. Parent na mile par sound.error() khud bajaye. */
  readonly beep = input(true);
  readonly minLength = input(DEFAULT_MIN_SCAN_LENGTH);
  readonly maxGapMs = input(DEFAULT_MAX_KEY_GAP_MS);

  readonly scanned = output<ScanEvent>();
  readonly rejected = output<string>();
  readonly cameraClick = output<void>();

  protected readonly sound = inject(ScanSoundService);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  private readonly tracker = new KeyBurstTracker();
  private lastKeyAt = Number.NEGATIVE_INFINITY;

  focus(): void {
    this.field().nativeElement.focus();
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submit();
      return;
    }
    if (e.key.length !== 1) return;
    const now = performance.now();
    // Lamba gap ho to naya run shuru: sirf aakhri tez run ginti mein aata hai.
    if (now - this.lastKeyAt > this.maxGapMs()) this.tracker.reset();
    this.lastKeyAt = now;
    this.tracker.push(now);
  }

  private submit(): void {
    const el = this.field().nativeElement;
    const value = cleanScan(el.value);
    const scanner = this.tracker.isBurst(this.minLength(), this.maxGapMs());
    this.tracker.reset();
    this.lastKeyAt = Number.NEGATIVE_INFINITY;
    el.value = '';

    if (!value) {
      el.focus();
      return;
    }
    if (this.scannerOnly() && !scanner) {
      this.sound.error();
      this.rejected.emit(value);
      el.focus();
      return;
    }
    if (this.beep()) this.sound.success();
    this.scanned.emit({ value, scanner });
    el.focus();
  }
}