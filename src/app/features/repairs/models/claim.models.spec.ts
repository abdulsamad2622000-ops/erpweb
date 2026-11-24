import { describe, expect, it } from 'vitest';
import { CLAIM_FLOW } from './claim.models';

describe('CLAIM_FLOW', () => {
  it('moves forward only', () => {
    expect(CLAIM_FLOW.open).toEqual(['sent']);
    expect(CLAIM_FLOW.sent).toEqual(['approved', 'rejected']);
    expect(CLAIM_FLOW.approved).toEqual(['credited']);
    expect(CLAIM_FLOW.rejected).toEqual([]);
    expect(CLAIM_FLOW.credited).toEqual([]);
  });
});
