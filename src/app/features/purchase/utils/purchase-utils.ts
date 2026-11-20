import { GrnLine, PoAction, PoLine, PoStatus } from '../models/purchase.models';

const ALLOWED: Record<PoStatus, PoAction[]> = {
  draft: ['edit', 'submit', 'cancel'],
  pending_approval: ['approve', 'reject'],
  approved: ['receive', 'cancel'],
  rejected: ['edit', 'submit', 'cancel'],
  partially_received: ['receive'],
  received: [],
  cancelled: [],
};

export function canDo(status: PoStatus, action: PoAction): boolean {
  return ALLOWED[status].includes(action);
}

export const lineTotal = (l: Pick<PoLine, 'qty' | 'unitCost'>): number => Math.round(l.qty * l.unitCost * 100) / 100;
export const poTotal = (lines: readonly Pick<PoLine, 'qty' | 'unitCost'>[]): number =>
  Math.round(lines.reduce((s, l) => s + lineTotal(l), 0) * 100) / 100;

/** PO line par ab kitna aana baqi hai. */
export const remaining = (l: Pick<PoLine, 'qty' | 'receivedQty'>): number => Math.max(0, l.qty - l.receivedQty);

/** Saare lines receive ho gaye to 'received', kuch to 'partially_received'. */
export function statusAfterReceipt(lines: readonly PoLine[]): PoStatus {
  if (lines.every((l) => remaining(l) === 0)) return 'received';
  return lines.some((l) => l.receivedQty > 0) ? 'partially_received' : 'approved';
}

/** GRN line ki is dafa ki qty: serialized par sirf accepted serials. */
export function grnLineQty(l: GrnLine): number {
  return l.serialized ? l.serials.filter((s) => s.status === 'accepted').length : l.qty;
}

/** Is GRN mein abhi tak kitna capture hua aur kitna aana tha. */
export function grnProgress(lines: readonly GrnLine[]): { done: number; expected: number } {
  return lines.reduce(
    (a, l) => ({ done: a.done + grnLineQty(l), expected: a.expected + Math.max(0, l.orderedQty - l.previouslyReceived) }),
    { done: 0, expected: 0 },
  );
}

/** Serial ka saaf roop: trim, uppercase, andar ke spaces hata kar. */
export const normalizeSerial = (s: string): string => s.trim().replace(/\s+/g, '').toUpperCase();

export const isSerialFormatOk = (s: string): boolean => /^[A-Z0-9][A-Z0-9-]{3,39}$/.test(s);

/** Paste ya CSV text: har line, comma, tab ya semicolon par ek serial. "serial" header aur duplicates hat jate hain. */
export function parseSerialList(text: string): string[] {
  const out: string[] = [];
  for (const cell of text.split(/[\r\n,;\t]+/)) {
    const s = normalizeSerial(cell.replace(/"/g, ''));
    if (s && s !== 'SERIAL' && !out.includes(s)) out.push(s);
  }
  return out;
}
