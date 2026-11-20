import { describe, expect, it } from 'vitest';
import { GrnLine, PoLine } from '../models/purchase.models';
import { canDo, grnLineQty, grnProgress, isSerialFormatOk, normalizeSerial, parseSerialList, poTotal, statusAfterReceipt } from './purchase-utils';

const line = (o: Partial<PoLine> = {}): PoLine => ({ productId: 1, sku: 'A', name: 'A', serialized: true, qty: 2, unitCost: 100, receivedQty: 0, ...o });
const gline = (o: Partial<GrnLine> = {}): GrnLine => ({ productId: 1, sku: 'A', name: 'A', serialized: true, orderedQty: 3, previouslyReceived: 1, qty: 0, serials: [], ...o });

describe('purchase utils', () => {
  it('PO ke status par sirf sahi actions', () => {
    expect(canDo('draft', 'submit')).toBe(true);
    expect(canDo('draft', 'approve')).toBe(false);
    expect(canDo('pending_approval', 'approve')).toBe(true);
    expect(canDo('approved', 'receive')).toBe(true);
    expect(canDo('received', 'receive')).toBe(false);
  });

  it('total aur receipt ke baad status', () => {
    expect(poTotal([line(), line({ qty: 1, unitCost: 50.5 })])).toBe(250.5);
    expect(statusAfterReceipt([line({ receivedQty: 1 })])).toBe('partially_received');
    expect(statusAfterReceipt([line({ receivedQty: 2 })])).toBe('received');
  });

  it('GRN qty: serialized par sirf accepted serials', () => {
    const l = gline({ serials: [
      { serial: 'A1', productId: 1, status: 'accepted', note: null },
      { serial: 'A2', productId: 1, status: 'rejected', note: 'Broken' },
    ] });
    expect(grnLineQty(l)).toBe(1);
    expect(grnLineQty(gline({ serialized: false, qty: 2 }))).toBe(2);
    expect(grnProgress([l])).toEqual({ done: 1, expected: 2 });
  });

  it('serial saaf hota aur format check hota hai', () => {
    expect(normalizeSerial(' 5cg 3412xyz ')).toBe('5CG3412XYZ');
    expect(isSerialFormatOk('5CG3412XYZ')).toBe(true);
    expect(isSerialFormatOk('AB')).toBe(false);
    expect(isSerialFormatOk('BAD SERIAL!')).toBe(false);
  });

  it('paste/CSV list: header, duplicates aur khaali hat jate hain', () => {
    expect(parseSerialList('serial\n5cg1111aaa\n"5CG2222BBB",5cg1111aaa\n\n5CG3333CCC;5CG4444DDD')).toEqual([
      '5CG1111AAA', '5CG2222BBB', '5CG3333CCC', '5CG4444DDD',
    ]);
  });
});
