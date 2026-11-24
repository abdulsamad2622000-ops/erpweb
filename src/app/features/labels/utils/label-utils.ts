import { escapeHtml } from '../../../shared/ui/print/print-utils';
import { LabelField, LabelItem, LabelTemplate, Symbology } from '../models/label.models';

export interface SizePreset {
  key: string;
  widthMm: number;
  heightMm: number;
}

export const SIZE_PRESETS: readonly SizePreset[] = [
  { key: '50x25', widthMm: 50, heightMm: 25 },
  { key: '62x32', widthMm: 62, heightMm: 32 },
  { key: '75x50', widthMm: 75, heightMm: 50 },
  { key: '100x50', widthMm: 100, heightMm: 50 },
];

export const ALL_FIELDS: readonly LabelField[] = ['company', 'name', 'sku', 'serial', 'specs', 'price', 'bin', 'code'];

/** EAN-13 ka 13wan (check) digit, 12 digits se. */
export function ean13CheckDigit(first12: string): number {
  const sum = [...first12].reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(value: string): boolean {
  return /^\d{13}$/.test(value) && ean13CheckDigit(value.slice(0, 12)) === Number(value[12]);
}

/** EAN sirf sahi 13 digit par chalta hai; warna Code128 par wapas. */
export function effectiveSymbology(wanted: Symbology, code: string): Symbology {
  return wanted === 'ean13' && !isValidEan13(code) ? 'code128' : wanted;
}

/** Jo item print ho chuka ho us ka dobara print = reprint (wajah zaroori). */
export function needsReprintReason(items: readonly LabelItem[]): boolean {
  return items.some((i) => i.printCount > 0);
}

function fieldValue(item: LabelItem, field: LabelField, company: string, money: (n: number) => string): string | null {
  switch (field) {
    case 'company': return company || null;
    case 'name': return item.name;
    case 'sku': return item.sku;
    case 'serial': return item.serial;
    case 'specs': return item.specs;
    case 'price': return item.price === null ? null : money(item.price);
    case 'bin': return item.bin;
    case 'code': return item.code;
  }
}

/** Label ki text lines (HTML aur PDF dono ke liye): sirf wohi fields jin ki value ho. Code line sirf QR par. */
export function labelLines(template: LabelTemplate, item: LabelItem, opts: LabelSheetOptions): string[] {
  const qr = effectiveSymbology(template.symbology, item.code) === 'qr';
  return template.fields
    .filter((f) => f !== 'code' || qr)
    .map((f) => fieldValue(item, f, opts.company, opts.money))
    .filter((v): v is string => !!v);
}

export interface LabelSheetOptions {
  company: string;
  logoUrl: string | null;
  money: (n: number) => string;
}

/** Labels ki sheet ka HTML. svgs[i] items[i] ka barcode hai (pehle se bana hua, trusted). */
export function buildLabelSheet(
  template: LabelTemplate,
  items: readonly LabelItem[],
  svgs: readonly string[],
  opts: LabelSheetOptions,
): string {
  const w = template.widthMm;
  const h = template.heightMm;
  const css =
    '<style>.sheet{display:flex;flex-wrap:wrap;gap:3mm}' +
    `.lbl{width:${w}mm;height:${h}mm;border:1px dashed #999;padding:1.5mm;display:flex;gap:1.5mm;` +
    'break-inside:avoid;overflow:hidden;font-size:8px;line-height:1.2}' +
    '.lbl.qr{flex-direction:row;align-items:center}.lbl.lin{flex-direction:column}' +
    '.lbl .txt{flex:1;min-width:0;overflow:hidden}.lbl .txt div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.lbl .bc{display:flex;align-items:center;justify-content:center}' +
    '.lbl.qr .bc{height:100%;aspect-ratio:1}.lbl.lin .bc{flex:1;min-height:0}.lbl .bc svg{max-width:100%;max-height:100%}' +
    '.lbl img{max-height:5mm}</style>';
  const cells = items.map((item, i) => {
    const qr = effectiveSymbology(template.symbology, item.code) === 'qr';
    const lines = template.fields
      .filter((f) => f !== 'code' || qr)
      .map((f) => fieldValue(item, f, opts.company, opts.money))
      .filter((v): v is string => !!v)
      .map((v, n) => `<div${n === 0 ? ' class="b"' : ''}>${escapeHtml(v)}</div>`)
      .join('');
    const logo = template.showLogo && opts.logoUrl ? `<img src="${escapeHtml(opts.logoUrl)}" alt="">` : '';
    return `<div class="lbl ${qr ? 'qr' : 'lin'}"><div class="txt">${logo}${lines}</div><div class="bc">${svgs[i] ?? ''}</div></div>`;
  });
  return `${css}<div class="sheet">${cells.join('')}</div>`;
}
