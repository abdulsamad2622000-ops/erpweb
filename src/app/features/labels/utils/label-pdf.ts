import type { jsPDF } from 'jspdf';
import { LabelItem, LabelTemplate } from '../models/label.models';
import { renderBarcodeSvg } from './barcode-render';
import { LabelSheetOptions, effectiveSymbology, labelLines } from './label-utils';
import { PdfLayout, Rect, fitContain, fitText, pdfLayout, pdfSafe, svgSize } from './label-pdf-layout';

const DPI = 300;
const mmToPx = (mm: number): number => Math.max(1, Math.round((mm / 25.4) * DPI));

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Barcode image failed to load.'));
    img.src = url;
  });
}

/** Barcode SVG ko safed background par PNG banata hai (PDF mein image ke taur par jati hai). */
async function svgToPng(svg: string, widthPx: number, heightPx: number): Promise<string> {
  const size = svgSize(svg);
  if (!size) throw new Error('Barcode has no size.');
  const box: Rect = { x: 0, y: 0, w: widthPx, h: heightPx };
  const fit = fitContain(size.w, size.h, box);
  const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  root.setAttribute('width', String(Math.max(1, Math.round(fit.w))));
  root.setAttribute('height', String(Math.max(1, Math.round(fit.h))));
  const xml = new XMLSerializer().serializeToString(root);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

interface Plan {
  lines: string[];
  layout: PdfLayout;
}

/** Har label ka ek page, template ke size ka (roll / thermal printer ke liye). jsPDF pehli dafa par lazy load hota hai. */
export async function buildLabelPdf(
  template: LabelTemplate,
  items: readonly LabelItem[],
  opts: LabelSheetOptions,
): Promise<jsPDF> {
  const [{ jsPDF: Pdf }, svgs] = await Promise.all([
    import('jspdf'),
    Promise.all(items.map((i) => renderBarcodeSvg(i.code, template.symbology))),
  ]);
  const w = template.widthMm;
  const h = template.heightMm;
  const orientation = w >= h ? 'landscape' : 'portrait';

  const plans: Plan[] = items.map((item) => {
    const qr = effectiveSymbology(template.symbology, item.code) === 'qr';
    const lines = labelLines(template, item, opts).map(pdfSafe);
    return { lines, layout: pdfLayout(w, h, qr, lines.length) };
  });
  const pngs = await Promise.all(
    plans.map((p, n) => svgToPng(svgs[n], mmToPx(p.layout.barcode.w), mmToPx(p.layout.barcode.h))),
  );

  const doc = new Pdf({ orientation, unit: 'mm', format: [w, h], compress: true });
  plans.forEach((p, n) => {
    if (n > 0) doc.addPage([w, h], orientation);
    const L = p.layout;
    doc.setFontSize(L.fontPt);
    p.lines.slice(0, L.maxLines).forEach((line, k) => {
      doc.setFont('helvetica', k === 0 ? 'bold' : 'normal');
      const text = fitText(line, L.text.w, (s) => doc.getTextWidth(s));
      doc.text(text, L.text.x, L.text.y + k * L.lineMm, { baseline: 'top' });
    });
    doc.addImage(pngs[n], 'PNG', L.barcode.x, L.barcode.y, L.barcode.w, L.barcode.h);
  });
  return doc;
}