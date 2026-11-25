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

export type Cell = string | number | null;

/** Excel sheet ka naam: 31 se zyada harf aur : \ / ? * [ ] nahi chalte. */
export function safeSheetName(name: string): string {
  const s = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return s || 'Sheet1';
}

/** Har column ki chaurai (characters mein), header aur data dono dekh kar. */
export function colWidths(headers: string[], rows: Cell[][]): number[] {
  return headers.map((h, i) => Math.min(60, Math.max(h.length, ...rows.map((r) => String(r[i] ?? '').length)) + 2));
}

/** ISO waqt ki local tareekh (YYYY-MM-DD). */
export function isoToLocalDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Tareekh from..to (dono shamil) ke andar hai? Khali from/to ka matlab koi hadd nahi. */
export function inDateRange(iso: string, from: string, to: string): boolean {
  const d = isoToLocalDate(iso);
  return (!from || d >= from) && (!to || d <= to);
}

/** Asli Excel workbook (.xlsx). Library pehli dafa par lazy load hoti hai. Text hamesha text rehta hai, formula nahi banta. */
export async function buildWorkbook(sheet: string, headers: string[], rows: Cell[][]) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = colWidths(headers, rows).map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheet));
  return wb;
}

export async function downloadXlsx(name: string, sheet: string, headers: string[], rows: Cell[][]): Promise<void> {
  const XLSX = await import('xlsx');
  XLSX.writeFile(await buildWorkbook(sheet, headers, rows), name);
}

/** Mahine ki pehli tareekh aur aaj (YYYY-MM-DD). */
export function monthRange(d = new Date()): { from: string; to: string } {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
}
