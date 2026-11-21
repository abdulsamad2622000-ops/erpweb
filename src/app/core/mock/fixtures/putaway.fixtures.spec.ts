import { describe, expect, it } from 'vitest';
import { PUTAWAY_FIXTURES } from './putaway.fixtures';

const BIN = 'BIN-LHR-SELL-A-R1-S1-B01';
const post = (body: unknown) =>
  PUTAWAY_FIXTURES['POST /inventory/putaway']({ method: 'POST', url: '/inventory/putaway', body });

describe('PUTAWAY_FIXTURES', () => {
  it('rejects a bin code that does not exist', () => {
    const res = post({ binBarcode: 'BIN-NOPE', serials: ['ABCD1234'] });
    expect(res.status).toBe(422);
    expect((res.body as { message: string }).message).toContain('Bin not found');
  });

  it('rejects an empty serial list', () => {
    expect(post({ binBarcode: BIN, serials: [] }).status).toBe(422);
  });

  it('rejects a serial that is not known', () => {
    const res = post({ binBarcode: BIN, serials: ['NO-SUCH-SERIAL'] });
    expect(res.status).toBe(422);
    expect((res.body as { message: string }).message).toContain('not known');
  });
});