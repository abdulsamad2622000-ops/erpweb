import { CLAIM_FLOW, ClaimStatus, SupplierClaim } from '../../../features/repairs/models/claim.models';
import { FixtureHandler, fail, ok } from './fixture.types';

const claims: SupplierClaim[] = [];
let seq = 0;
const idOf = (url: string): number => Number(url.split('?')[0].split('/').slice(-2)[0]);

export const CLAIM_HANDLERS: Record<string, FixtureHandler> = {
  'GET /warranty/supplier-claims': () => ok({ data: claims, total: claims.length }),
  'POST /warranty/supplier-claims': (req) => {
    const b = req.body as { serial?: string; supplier?: string; reason?: string };
    if (!b.serial?.trim()) return fail(422, 'Enter the serial number.');
    if (!b.supplier?.trim()) return fail(422, 'Enter the supplier.');
    if ((b.reason ?? '').trim().length < 10) return fail(422, 'Write the reason (at least 10 characters).');
    seq += 1;
    const c: SupplierClaim = {
      id: seq, number: `SC-${String(seq).padStart(4, '0')}`, serial: b.serial.trim(), supplier: b.supplier.trim(),
      reason: b.reason!.trim(), status: 'open', note: null, createdAt: new Date().toISOString(), by: 'Demo user',
    };
    claims.unshift(c);
    return ok(c);
  },
  'POST /warranty/supplier-claims/:id/status': (req) => {
    const c = claims.find((x) => x.id === idOf(req.url));
    if (!c) return fail(404, 'Not found.');
    const b = req.body as { status: ClaimStatus; note?: string | null };
    if (!CLAIM_FLOW[c.status].includes(b.status)) return fail(422, 'This status change is not allowed.');
    c.status = b.status;
    c.note = b.note ?? c.note;
    return ok(c);
  },
};
