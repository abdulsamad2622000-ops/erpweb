import { CartLine, Payment, PosItem, Sale } from '../models/pos.models';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const lineTotal = (l: CartLine): number => round2(l.qty * (l.price ?? 0));

export const subtotalOf = (lines: CartLine[]): number => round2(lines.reduce((s, l) => s + lineTotal(l), 0));

/** Zyada se zyada discount (rupees). limit null = koi had nahi, sirf bill tak. */
export function maxDiscount(subtotal: number, limit: number | null): number {
  return limit === null ? subtotal : round2((subtotal * limit) / 100);
}

/** Cart mein item daalo. Serial dobara nahi; bina serial item ki qty barhti hai. Wapas: naya cart ya error key. */
export function addToCart(lines: CartLine[], item: PosItem): { lines: CartLine[]; error: string | null } {
  if (item.price === null) return { lines, error: 'posPage.noPrice' };
  if (item.serial) {
    if (lines.some((l) => l.serial === item.serial)) return { lines, error: 'posPage.alreadyInCart' };
    return { lines: [...lines, { ...item, qty: 1 }], error: null };
  }
  const i = lines.findIndex((l) => !l.serial && l.productId === item.productId);
  if (i >= 0) return { lines: lines.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l)), error: null };
  return { lines: [...lines, { ...item, qty: 1 }], error: null };
}

export interface Totals {
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  due: number;
  change: number;
}

export function totals(lines: CartLine[], discount: number, payments: Payment[]): Totals {
  const subtotal = subtotalOf(lines);
  const d = round2(Math.min(Math.max(discount || 0, 0), subtotal));
  const total = round2(subtotal - d);
  const paid = round2(payments.reduce((s, p) => s + (p.amount || 0), 0));
  return { subtotal, discount: d, total, paid, due: round2(Math.max(total - paid, 0)), change: round2(Math.max(paid - total, 0)) };
}

/** Bill complete ho sakta hai? Wapas: null ya i18n error key. */
export function saleProblem(lines: CartLine[], discount: number, limit: number | null, payments: Payment[]): string | null {
  if (!lines.length) return 'posPage.emptyCart';
  const t = totals(lines, discount, payments);
  if (discount < 0 || discount > t.subtotal) return 'posPage.discountTooHigh';
  if (discount > maxDiscount(t.subtotal, limit) + 0.001) return 'posPage.discountOverLimit';
  if (payments.some((p) => !(p.amount > 0))) return 'posPage.badPayment';
  if (t.paid + 0.001 < t.total) return 'posPage.underpaid';
  const cash = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  if (t.change > cash + 0.001) return 'posPage.onlyCashChange';
  return null;
}

export const money = (n: number): string =>
  n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** Warranty khatam hone ki tareekh (YYYY-MM-DD). */
export function warrantyUntil(saleDate: string, months: number): string | null {
  if (!months) return null;
  const d = new Date(saleDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export interface ReceiptLabels {
  shop: string;
  tagline: string;
  receipt: string;
  cashier: string;
  customer: string;
  subtotal: string;
  discount: string;
  total: string;
  paid: string;
  change: string;
  warranty: string;
  thanks: string;
  methods: Record<string, string>;
}

/** 80mm thermal receipt ka body HTML (PrintService thermal80 ke saath). Sab text escape hota hai. */
export function receiptHtml(sale: Sale, l: ReceiptLabels): string {
  const rows = sale.lines
    .map((x) => {
      const w = warrantyUntil(sale.createdAt, x.warrantyMonths);
      return `<tr><td colspan="2"><b>${esc(x.name)}</b>${x.serial ? `<br><small>S/N ${esc(x.serial)}</small>` : ''}${
        w ? `<br><small>${esc(l.warranty)}: ${w}</small>` : ''
      }</td></tr><tr><td>${x.qty} × ${money(x.unitPrice)}</td><td class="r">${money(x.qty * x.unitPrice)}</td></tr>`;
    })
    .join('');
  const pays = sale.payments
    .map((p) => `<tr><td>${esc(l.methods[p.method] ?? p.method)}</td><td class="r">${money(p.amount)}</td></tr>`)
    .join('');
  const when = new Date(sale.createdAt).toLocaleString('en-PK');
  return `<style>.rc{width:74mm;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#000}
h1{font-size:16px;margin:0;text-align:center;color:#1E3A8A}h1 span{color:#00BCD4}.c{text-align:center}.r{text-align:right}
table{width:100%;border-collapse:collapse}td{padding:1px 0;vertical-align:top}hr{border:0;border-top:1px dashed #000;margin:4px 0}
.t td{font-size:14px;font-weight:bold}</style><div class="rc">
<h1>Novastack<span>hub</span></h1><p class="c" style="margin:0">${esc(l.tagline)}</p><hr>
<p style="margin:0">${esc(l.receipt)}: <b>${esc(sale.number)}</b><br>${esc(when)}<br>${esc(l.cashier)}: ${esc(sale.cashier)}${
    sale.customer ? `<br>${esc(l.customer)}: ${esc(sale.customer.name)} ${esc(sale.customer.phone)}` : ''
  }</p><hr><table>${rows}</table><hr><table>
<tr><td>${esc(l.subtotal)}</td><td class="r">${money(sale.subtotal)}</td></tr>${
    sale.discount ? `<tr><td>${esc(l.discount)}</td><td class="r">-${money(sale.discount)}</td></tr>` : ''
  }<tr class="t"><td>${esc(l.total)}</td><td class="r">${money(sale.total)}</td></tr></table><hr><table>${pays}${
    sale.change ? `<tr><td>${esc(l.change)}</td><td class="r">${money(sale.change)}</td></tr>` : ''
  }</table><hr><p class="c">${esc(l.thanks)}</p></div>`;
}

/** Return mein kitna wapas: bill ka discount barabar baant ke. */
export function refundFor(sale: Sale, picks: { saleLineId: number; qty: number }[]): number {
  const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;
  return round2(
    picks.reduce((s, p) => {
      const l = sale.lines.find((x) => x.id === p.saleLineId);
      return l ? s + round2(p.qty * l.unitPrice * ratio) : s;
    }, 0),
  );
}
