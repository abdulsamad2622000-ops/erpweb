import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ScanSoundService } from './scan-sound.service';
import { cleanScan } from './scan-utils';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new () => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | undefined {
  return (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

/** ZXing ka sirf wo hissa jo hum use karte hain (test mein fake dena asaan). */
export type ZxingModule = Pick<typeof import('@zxing/browser'), 'BrowserMultiFormatReader'>;

/** ZXing tab hi download hota hai jab browser mein BarcodeDetector na ho (jaise iPhone Safari). */
export const ZXING_LOADER = new InjectionToken<() => Promise<ZxingModule>>('ZXING_LOADER', {
  providedIn: 'root',
  factory: () => () => import('@zxing/browser'),
});

interface ScannerControlsLike {
  stop(): void;
}

/**
 * Camera se barcode/QR scan. Parent [open] true kare, code milne par (detected) aur (closed) aate hain.
 * Pehle browser ka BarcodeDetector use hota hai; na ho to ZXing (lazy) chalta hai.
 * Is component ko lazy import karein (index.ts se export nahi).
 */
@Component({
  selector: 'app-scan-camera',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100"
      aria-labelledby="scan-cam-title"
      (cancel)="onCancel($event)"
    >
      <div class="p-4">
        <h2 id="scan-cam-title" class="mb-3 text-lg font-semibold">
          {{ 'common.scan.camera' | transloco }}
        </h2>
        @if (error(); as key) {
          <p role="alert" class="text-sm text-red-600">{{ key | transloco }}</p>
        }
        <video
          #video
          class="aspect-video w-full rounded-lg bg-black object-cover"
          [class.hidden]="error() !== null"
          playsinline
          muted
        ></video>
        @if (!error()) {
          <p class="mt-2 text-xs text-slate-600 dark:text-slate-400">
            {{ 'common.scan.cameraHint' | transloco }}
          </p>
        }
        <ng-content />
      </div>
      <div class="flex justify-end border-t border-slate-200 p-4 dark:border-slate-700">
        <button
          type="button"
          class="min-h-12 rounded-lg border border-slate-300 px-4 font-medium dark:border-slate-600"
          (click)="close()"
        >
          {{ 'common.cancel' | transloco }}
        </button>
      </div>
    </dialog>
  `,
})
export class ScanCameraComponent {
  readonly open = input(false);
  /** Kitni der baad dobara code dhoondna hai. */
  readonly intervalMs = input(250);
  /** true ho to code milne par camera khula rehta hai aur lagatar scan karta hai (put-away, count). */
  readonly continuous = input(false);
  /** Continuous mode mein wahi code is muddat (ms) ke andar dobara nahi bheja jata. */
  readonly repeatGuardMs = input(1500);

  readonly detected = output<string>();
  readonly closed = output<void>();

  protected readonly error = signal<string | null>(null);

  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly sound = inject(ScanSoundService);
  private readonly loadZxing = inject(ZXING_LOADER);

  private stream: MediaStream | null = null;
  private controls: ScannerControlsLike | null = null;
  private readonly stoppedControls = new WeakSet<ScannerControlsLike>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;
  /** Har start/stop par badalta hai, taake der se aane wala async kaam purana ho to ruk jaye. */
  private session = 0;
  private lastCode = '';
  private lastAt = 0;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const el = this.dlg().nativeElement;
      if (isOpen && !el.open) {
        el.showModal();
        void this.start();
      }
      if (!isOpen && el.open) {
        this.stop();
        el.close();
      }
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  protected close(): void {
    this.stop();
    this.closed.emit();
  }

  protected onCancel(event: Event): void {
    // Esc dabane par.
    event.preventDefault();
    this.close();
  }

  private async start(): Promise<void> {
    this.error.set(null);
    const media = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (!media?.getUserMedia) {
      this.error.set('common.scan.cameraUnsupported');
      return;
    }
    const session = ++this.session;
    this.lastCode = '';
    this.lastAt = 0;
    const Detector = detectorCtor();
    if (Detector) {
      await this.startNative(Detector, media, session);
    } else {
      await this.startZxing(session);
    }
  }

  private async startNative(Detector: BarcodeDetectorCtor, media: MediaDevices, session: number): Promise<void> {
    try {
      const stream = await media.getUserMedia({ video: { facingMode: 'environment' } });
      if (!this.open() || session !== this.session) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      const video = this.video().nativeElement;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Autoplay rok de to bhi detect chalta rahega.
      }
      const detector = new Detector();
      this.timer = setInterval(() => void this.tick(detector), this.intervalMs());
    } catch {
      this.error.set('common.scan.cameraDenied');
    }
  }

  private async startZxing(session: number): Promise<void> {
    try {
      const { BrowserMultiFormatReader } = await this.loadZxing();
      if (!this.open() || session !== this.session) return;
      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: this.intervalMs(),
      });
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        this.video().nativeElement,
        (result, _err, ctrl) => {
          this.controls ??= ctrl;
          const code = cleanScan(result?.getText() ?? '');
          if (code) this.finish(code);
        },
      );
      if (!this.open() || session !== this.session) {
        this.stopControls(controls);
        return;
      }
      this.controls ??= controls;
    } catch {
      this.error.set('common.scan.cameraDenied');
    }
  }

  private async tick(detector: BarcodeDetectorLike): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const found = await detector.detect(this.video().nativeElement);
      const code = cleanScan(found[0]?.rawValue ?? '');
      if (code) this.finish(code);
    } catch {
      // Ek frame fail ho to agla try karte hain.
    } finally {
      this.busy = false;
    }
  }

  private finish(code: string): void {
    if (this.continuous()) {
      const now = Date.now();
      if (code === this.lastCode && now - this.lastAt < this.repeatGuardMs()) return;
      this.lastCode = code;
      this.lastAt = now;
      this.detected.emit(code);
      return;
    }
    this.stop();
    this.sound.success();
    this.detected.emit(code);
    this.closed.emit();
  }

  private stopControls(c: ScannerControlsLike): void {
    if (this.stoppedControls.has(c)) return;
    this.stoppedControls.add(c);
    try {
      c.stop();
    } catch {
      // Pehle se band ho to koi masla nahi.
    }
  }

  private stop(): void {
    this.session++;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.controls) this.stopControls(this.controls);
    this.controls = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video().nativeElement.srcObject = null;
  }
}