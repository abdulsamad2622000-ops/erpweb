import { round2 } from '../../pos/utils/pos-utils';
import { BadgeTone } from '../../../shared/ui/status-badge/status-badge.component';
import { InvoiceStatus, OrderLine, OrderStatus, QuotationStatus } from '../models/sales.models';

export const QUOTATION_TONE: Record<QuotationStatus, BadgeTone> = {
  draft: 'neutral', sent: 'info', accepted: 'success', cancelled: 'danger', expired: 'warning',
};
export const ORDER_TONE: Record<OrderStatus, BadgeTone> = { open: 'info', partial: 'warning', delivered: 'success', cancelled: 'danger' };
export const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = { unpaid: 'warning', partial: 'info', paid: 'success', overdue: 'danger' };

export interface EditLine {
  productId: number;
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  tierPrice: number;
  lowestPrice: number;
}

export const docTotal = (lines: { qty: number; unitPrice: number }[]): number =>
  round2(lines.reduce((s, l) => s + (l.qty || 0) * (l.unitPrice || 0), 0));

/** Line mein ghalti ki i18n key (ya null). */
export function lineProblem(l: EditLine): string | null {
  if (!(l.qty >= 1) || !Number.isInteger(l.qty)) return 'salesDocs.errors.qty';
  if (!(l.unitPrice > 0)) return 'salesDocs.errors.price';
  if (l.unitPrice + 0.001 < l.lowestPrice) return 'salesDocs.errors.belowLowest';
  return null;
}

/** Order line par kitna baqi deliver karna hai. */
export const leftToDeliver = (l: OrderLine): number => Math.max(l.qty - l.deliveredQty, 0);

/** Credit check jo backend karta hai, UI mein pehle se dikhane ke liye. Wapas: kitna udhaar hoga, aur kya limit se bahar hai. */
export function creditCheck(
  total: number,
  paying: number,
  balance: number,
  limit: number,
): { credit: number; allowed: boolean } {
  const credit = round2(Math.max(total - paying, 0));
  if (credit <= 0.004) return { credit: 0, allowed: true };
  return { credit, allowed: limit > 0 && balance + credit <= limit + 0.001 };
}

/** Quotation/order/challan/invoice ka saada print body (A4). Sab text escape. */
export function docPrintHtml(o: {
  title: string;
  number: string;
  date: string;
  party: string;
  rows: { name: string; detail: string; qty: number; price: number | null }[];
  total: number | null;
  footer: string;
  labels: { item: string; qty: string; price: string; amount: string; total: string };
}): string {
  const esc = (s: string): string =>
    s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const fmt = (n: number): string => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });
  const showPrice = o.rows.some((r) => r.price !== null);
  const body = o.rows
    .map(
      (r) =>
        `<tr><td>${esc(r.name)}${r.detail ? `<br><small>${esc(r.detail)}</small>` : ''}</td><td class="r">${r.qty}</td>${
          showPrice ? `<td class="r">${fmt(r.price ?? 0)}</td><td class="r">${fmt((r.price ?? 0) * r.qty)}</td>` : ''
        }</tr>`,
    )
    .join('');
  return `<style>.doc{font:12px/1.4 system-ui,sans-serif;color:#000}.doc h1{margin:0;color:#1E3A8A;font-size:22px}.doc h1 span{color:#00BCD4}
.doc table{width:100%;border-collapse:collapse;margin-top:12px}.doc th,.doc td{border-bottom:1px solid #ccc;padding:4px;text-align:start}
.doc .r{text-align:end}.doc .t td{font-weight:bold;font-size:14px;border:0}</style><div class="doc">
<h1>Novastack<span>hub</span></h1><p style="margin:0">Empowering Digital Vision</p>
<h2 style="margin:12px 0 4px">${esc(o.title)} ${esc(o.number)}</h2><p style="margin:0">${esc(o.date)}<br>${esc(o.party)}</p>
<table><thead><tr><th>${esc(o.labels.item)}</th><th class="r">${esc(o.labels.qty)}</th>${
    showPrice ? `<th class="r">${esc(o.labels.price)}</th><th class="r">${esc(o.labels.amount)}</th>` : ''
  }</tr></thead><tbody>${body}</tbody>${
    o.total !== null ? `<tfoot><tr class="t"><td colspan="${showPrice ? 3 : 1}" class="r">${esc(o.labels.total)}</td><td class="r">${fmt(o.total)}</td></tr></tfoot>` : ''
  }</table><p style="margin-top:24px">${esc(o.footer)}</p></div>`;
}
