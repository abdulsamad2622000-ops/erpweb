import { parseNumber } from '../number-input/number-utils';

export type ImportValue = string | number | null;

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'number' | 'date';
  /** true ho to file ke andar duplicate value error hai. */
  unique?: boolean;
  /** Header ke doosre naam jo auto-match mein kaam aayein. */
  aliases?: string[];
}

export interface ImportRow {
  /** File ki line (header line 1 hai). */
  line: number;
  values: Record<string, ImportValue>;
  errors: string[];
}

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Quotes, comma aur newline wali CSV. Khali lines hata deta hai. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Har field ke liye header ka index (na mile to -1). */
export function autoMap(headers: string[], fields: ImportField[]): number[] {
  const normalized = headers.map(norm);
  return fields.map((f) => {
    const names = [f.key, f.label, ...(f.aliases ?? [])].map(norm);
    return normalized.findIndex((h) => names.includes(h));
  });
}

function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** data mein header wali line nahi hoti. mapping[i] = field i ka column index. */
export function validateRows(data: string[][], mapping: number[], fields: ImportField[]): ImportRow[] {
  const seen = fields.map(() => new Set<string>());
  return data.map((cells, r) => {
    const values: Record<string, ImportValue> = {};
    const errors: string[] = [];
    fields.forEach((f, i) => {
      const idx = mapping[i];
      const raw = idx >= 0 ? (cells[idx] ?? '').trim() : '';
      if (raw === '') {
        values[f.key] = null;
        if (f.required) errors.push(f.label + ' is required');
        return;
      }
      if (f.type === 'number') {
        const n = parseNumber(raw);
        if (n === null || Number.isNaN(n)) {
          values[f.key] = null;
          errors.push(f.label + ' must be a number');
          return;
        }
        values[f.key] = n;
      } else if (f.type === 'date') {
        if (!isIsoDate(raw)) {
          values[f.key] = null;
          errors.push(f.label + ' must be a date (yyyy-mm-dd)');
          return;
        }
        values[f.key] = raw;
      } else {
        values[f.key] = raw;
      }
      if (f.unique) {
        const key = raw.toLowerCase();
        if (seen[i].has(key)) errors.push(f.label + ' is duplicated in the file');
        seen[i].add(key);
      }
    });
    return { line: r + 2, values, errors };
  });
}

export function sampleCsv(fields: ImportField[]): string {
  return fields.map((f) => f.label).join(',') + '\n';
}
