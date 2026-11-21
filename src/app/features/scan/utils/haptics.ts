/** Phone ko halka sa vibrate karta hai. Support na ho (iPhone Safari, desktop) to chupchap kuch nahi karta. */
export const VIBRATE_OK = 60;
export const VIBRATE_ERROR: number[] = [120, 60, 120];

export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Vibration sirf ek ishara hai, fail ho to koi masla nahi.
  }
}