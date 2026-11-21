/** CSV (Excel mein khulta hai). Har cell quote, formula injection se bachao. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null): string => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Browser mein CSV download (BOM ke saath taake Excel Urdu/UTF-8 theek dikhaye). */
export function downloadCsv(name: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Bar chart ke liye 0–100% height. */
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.round((v / max) * 100) : 0));
}

/** Mahine ki pehli tareekh aur aaj (YYYY-MM-DD). */
export function monthRange(d = new Date()): { from: string; to: string } {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
}
