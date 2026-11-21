import { visibleMenu } from './menu.config';

describe('visibleMenu', () => {
  it('permission ke baghair menu khali', () => {
    expect(visibleMenu(() => false)).toEqual([]);
  });

  it('group mein sirf allowed children', () => {
    const m = visibleMenu((k) => k === 'inventory.stock.view');
    expect(m.map((i) => i.key)).toEqual(['inventory']);
    // Stock alerts stock ki hi permission par hain, is liye stock dekhne wala alerts bhi dekhta hai.
    expect(m[0].children?.map((c) => c.key)).toEqual(['stock', 'alerts']);
  });

  it('website flag off ho to sab permissions ke baad bhi chhupa', () => {
    expect(visibleMenu(() => true).some((i) => i.key === 'website')).toBe(false);
  });
});