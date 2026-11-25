import { LabelKind } from '../models/label.models';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfLayout {
  fontPt: number;
  lineMm: number;
  /** Itni lines text area mein aati hain. */
  maxLines: number;
  text: Rect;
  barcode: Rect;
}

const PAD_MM = 1.5;
const GAP_MM = 1.5;
const PT_TO_MM = 0.3528;

/** PDF ka ek page = ek label. Sab naap millimetre mein, page ke top-left se. */
export function pdfLayout(widthMm: number, heightMm: number, qr: boolean, lineCount: number): PdfLayout {
  const fontPt = heightMm <= 26 ? 6 : heightMm <= 40 ? 7 : 8;
  const lineMm = Math.round(fontPt * PT_TO_MM * 1.25 * 1000) / 1000;
  const innerW = widthMm - 2 * PAD_MM;
  const innerH = heightMm - 2 * PAD_MM;

  if (qr) {
    // QR dayen taraf, text baen taraf.
    const side = Math.min(innerH, innerW * 0.5);
    const barcode: Rect = { x: widthMm - PAD_MM - side, y: PAD_MM + (innerH - side) / 2, w: side, h: side };
    const text: Rect = { x: PAD_MM, y: PAD_MM, w: innerW - side - GAP_MM, h: innerH };
    return { fontPt, lineMm, maxLines: Math.max(1, Math.floor(text.h / lineMm)), text, barcode };
  }

  // Linear barcode: text upar (zyada se zyada 55% height), barcode neeche.
  const lines = Math.min(lineCount, Math.max(1, Math.floor((innerH * 0.55) / lineMm)));
  const textH = lines * lineMm;
  const gap = lines > 0 ? GAP_MM : 0;
  return {
    fontPt,
    lineMm,
    maxLines: lines,
    text: { x: PAD_MM, y: PAD_MM, w: innerW, h: textH },
    barcode: { x: PAD_MM, y: PAD_MM + textH + gap, w: innerW, h: innerH - textH - gap },
  };
}

/** src size ko box ke andar (nisbat bachate hue) center mein fit karta hai. */
export function fitContain(srcW: number, srcH: number, box: Rect): Rect {
  if (srcW <= 0 || srcH <= 0) return { ...box };
  const scale = Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** SVG text ke viewBox se us ki asli chaurai/unchai. */
export function svgSize(svg: string): { w: number; h: number } | null {
  const m = /viewBox\s*=\s*"\s*([\d.+-]+)[\s,]+([\d.+-]+)[\s,]+([\d.+-]+)[\s,]+([\d.+-]+)\s*"/.exec(svg);
  if (!m) return null;
  const w = Number(m[3]);
  const h = Number(m[4]);
  return w > 0 && h > 0 ? { w, h } : null;
}

/** Text agar jagah se lamba ho to "..." laga kar chhota karta hai. measure = text ki chaurai (mm). */
export function fitText(text: string, maxWidth: number, measure: (s: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && measure(t + '...') > maxWidth) t = t.slice(0, -1);
  return t + '...';
}

/** PDF ke standard fonts sirf Latin-1 jante hain; baqi characters '?' ban jate hain. */
export function pdfSafe(s: string): string {
  return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

export function labelPdfName(kind: LabelKind, now: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `labels-${kind}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.pdf`;
}