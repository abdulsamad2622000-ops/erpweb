import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'erp.scan.muted';

interface Tone {
  freq: number;
  ms: number;
}

const SUCCESS_TONES: Tone[] = [{ freq: 1200, ms: 90 }];
const ERROR_TONES: Tone[] = [
  { freq: 300, ms: 140 },
  { freq: 300, ms: 140 },
];
const GAP_S = 0.06;

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Scan par beep: success par ek, error par do. Mute ka choice yaad rehta hai. */
@Injectable({ providedIn: 'root' })
export class ScanSoundService {
  private readonly _muted = signal(readMuted());
  readonly muted = this._muted.asReadonly();
  private ctx: AudioContext | null = null;

  setMuted(value: boolean): void {
    this._muted.set(value);
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // Storage band ho to bhi mute is session mein chalta rahega.
    }
  }

  toggle(): void {
    this.setMuted(!this._muted());
  }

  success(): void {
    this.play(SUCCESS_TONES);
  }

  error(): void {
    this.play(ERROR_TONES);
  }

  private play(tones: Tone[]): void {
    if (this._muted() || typeof AudioContext === 'undefined') return;
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      void ctx.resume();
      let at = ctx.currentTime;
      for (const t of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = t.freq;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + t.ms / 1000);
        at += t.ms / 1000 + GAP_S;
      }
    } catch {
      // Audio na chale to scan ka kaam nahi rukna chahiye.
    }
  }
}