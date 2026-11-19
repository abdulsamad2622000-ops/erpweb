/** 'label': page size extraCss deta hai (label printer). */
export type PaperSize = 'a4' | 'thermal80' | 'label';

/** Print HTML mein jane wali har value is se guzarein. */
export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #000; font-family: Inter, Arial, sans-serif; }
  h1, h2, p { margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 3px 4px; vertical-align: top; }
  .c { text-align: center; }
  .r { text-align: end; }
  .b { font-weight: 700; }
  .muted { color: #444; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .serials { font-size: 10px; color: #333; word-break: break-all; }
`;

const A4_CSS = `
  @page { size: A4; margin: 12mm; }
  body { font-size: 12px; }
  th { border-bottom: 1px solid #000; text-align: start; }
  td { border-bottom: 1px solid #ddd; }
`;

const THERMAL_CSS = `
  @page { size: 80mm auto; margin: 3mm; }
  body { width: 74mm; font-size: 11px; }
`;

/** Poora printable HTML document. body ko pehle se escape karna parent ki zimmedari hai. */
export function buildPrintDocument(
  title: string,
  body: string,
  paper: PaperSize,
  dir: 'ltr' | 'rtl' = 'ltr',
  extraCss = '',
): string {
  const paperCss = paper === 'a4' ? A4_CSS : paper === 'thermal80' ? THERMAL_CSS : '';
  const css = BASE_CSS + paperCss + extraCss;
  return (
    '<!doctype html><html dir="' + dir + '"><head><meta charset="utf-8">' +
    '<title>' + escapeHtml(title) + '</title><style>' + css + '</style></head>' +
    '<body>' + body + '</body></html>'
  );
}
