/** Text se number. Khali = null, ghalat = NaN. Comma, space aur "Rs"/"PKR" ignore hote hain. */
export function parseNumber(text: string): number | null {
  const s = text.replace(/[\s,]/g, '').replace(/^(rs\.?|pkr)/i, '');
  if (s === '') return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

export function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function formatNumber(n: number, decimals: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}