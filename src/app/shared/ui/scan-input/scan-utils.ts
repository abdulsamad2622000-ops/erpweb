/** USB scanner har key ~50 ms ke andar bhejta hai. Insaan is se dheere type karta hai. */
export const DEFAULT_MAX_KEY_GAP_MS = 50;
/** Is se chhota text scan nahi maana jata (galti se chhoti burst). */
export const DEFAULT_MIN_SCAN_LENGTH = 4;

/** Control characters hata kar trim karta hai. */
export function cleanScan(raw: string): string {
  let out = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code !== 127) out += ch;
  }
  return out.trim();
}

/** Keys ke waqt (ms) jama karta hai aur batata hai ke burst scanner jaisi thi ya nahi. */
export class KeyBurstTracker {
  private times: number[] = [];

  push(nowMs: number): void {
    this.times.push(nowMs);
  }

  reset(): void {
    this.times = [];
  }

  get count(): number {
    return this.times.length;
  }

  isBurst(
    minLength: number = DEFAULT_MIN_SCAN_LENGTH,
    maxGapMs: number = DEFAULT_MAX_KEY_GAP_MS,
  ): boolean {
    if (this.times.length < minLength) return false;
    for (let i = 1; i < this.times.length; i++) {
      if (this.times[i] - this.times[i - 1] > maxGapMs) return false;
    }
    return true;
  }
}