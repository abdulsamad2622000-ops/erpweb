import { escapeHtml } from '../../../shared/ui/print/print-utils';
import { LabelField, LabelItem, LabelTemplate } from '../models/barcode.models';

export interface RenderedLabel {
  item: LabelItem;
  /** Hamari apni library ka bana SVG (user ka text is mein escape ho chuka hota hai). */
  svg: string;
  copies: number;
}

export interface LabelContext {
  companyName: string;
  logoUrl: string | null;
  formatPrice: (n: number) => string;
}

/** Label ke page aur dabbe ka CSS: har label apna page (label printer ke liye). */
export function labelCss(t: Pick<LabelTemplate, 'widthMm' | 'heightMm'>): string {
  return (
    `@page { size: ${t.widthMm}mm ${t.heightMm}mm; margin: 0; }` +
    'body { margin: 0; }' +
    `.lbl { width: ${t.widthMm}mm; height: ${t.heightMm}mm; padding: 1.5mm; overflow: hidden;` +
    ' display: flex; flex-direction: column; justify-content: space-between; page-break-after: always;' +
    ' break-after: page; font-family: Inter, Arial, sans-serif; color: #000; }' +
    '.lbl:last-child { page-break-after: auto; break-after: auto; }' +
    '.lbl .t { font-size: 8pt; font-weight: 700; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
    '.lbl .s, .lbl .c { font-size: 6.5pt; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
    '.lbl .bc { flex: 1; min-height: 0; display: flex; justify-content: center; align-items: center; padding: 0.5mm 0; }' +
    '.lbl .bc svg { max-height: 100%; }' +
    '.lbl .v { font-family: monospace; font-size: 7pt; text-align: center; letter-spacing: 0.3px; }' +
    '.lbl .row { display: flex; justify-content: space-between; align-items: center; gap: 1mm; }' +
    '.lbl .p { font-size: 8pt; font-weight: 700; }' +
    '.lbl .logo { height: 3.5mm; }'
  );
}

function line(cls: string, text: string): string {
  return `<div class="${cls}">${escapeHtml(text)}</div>`;
}

/** Ek label ka HTML. Sirf template mein chune hue fields dikhte hain. */
export function labelHtml(t: LabelTemplate, l: RenderedLabel, ctx: LabelContext): string {
  const has = (f: LabelField) => t.fields.includes(f);
  const parts: string[] = [];

  const top: string[] = [];
  if (t.showLogo && ctx.logoUrl) top.push(`<img class="logo" alt="" src="${escapeHtml(ctx.logoUrl)}">`);
  if (has('company')) top.push(`<span class="c">${escapeHtml(ctx.companyName)}</span>`);
  if (top.length) parts.push(`<div class="row">${top.join('')}</div>`);

  if (has('title')) parts.push(line('t', l.item.title));
  if (has('subtitle') && l.item.subtitle) parts.push(line('s', l.item.subtitle));
  parts.push(`<div class="bc">${l.svg}</div>`);

  const bottom: string[] = [];
  if (has('value')) bottom.push(`<span class="v">${escapeHtml(l.item.value)}</span>`);
  if (has('price') && l.item.price !== null) bottom.push(`<span class="p">${escapeHtml(ctx.formatPrice(l.item.price))}</span>`);
  if (bottom.length) parts.push(`<div class="row">${bottom.join('')}</div>`);

  return `<div class="lbl">${parts.join('')}</div>`;
}

/** Saare labels (copies samet) ka body HTML. */
export function labelsBody(t: LabelTemplate, labels: RenderedLabel[], ctx: LabelContext): string {
  return labels.flatMap((l) => Array.from({ length: Math.max(0, l.copies) }, () => labelHtml(t, l, ctx))).join('');
}

export function totalLabels(labels: { copies: number }[]): number {
  return labels.reduce((n, l) => n + Math.max(0, l.copies), 0);
}
