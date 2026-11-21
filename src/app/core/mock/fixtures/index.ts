import { ROLE_FIXTURES, USER_FIXTURES } from './users.fixtures';
import { AUDIT_FIXTURES, OVERRIDE_FIXTURES, auditWrap } from './permissions.fixtures';
// Sab fixtures isi folder mein (baad mein remove karna aasan)
import { AUTH_FIXTURES } from './auth.fixtures';
import { FixtureHandler, ok } from './fixture.types';
import { PRODUCT_FIXTURES } from './products.fixtures';
import { PRICE_HISTORY_FIXTURES } from './price-history.fixtures';
import { ORG_FIXTURES } from './org.fixtures';
import { SETTINGS_FIXTURES } from './settings.fixtures';
import { RECOVERY_FIXTURES } from './recovery.fixtures';
import { LABEL_FIXTURES } from './labels.fixtures';
import { PURCHASE_FIXTURES } from './purchase.fixtures';
import { PAYABLES_FIXTURES } from './payables.fixtures';
import { STOCK_FIXTURES } from './stock.fixtures';
import { TRANSFER_FIXTURES } from './transfers.fixtures';
import { COUNT_FIXTURES } from './counts.fixtures';
import { ADJUSTMENT_FIXTURES } from './adjustments.fixtures';
import { POS_FIXTURES } from './pos.fixtures';
import { REPAIR_FIXTURES } from './repairs.fixtures';
import { REPORT_FIXTURES } from './reports.fixtures';
import { RESERVATION_FIXTURES } from './reservations.fixtures';
import { SALES_FIXTURES } from './sales.fixtures';
import { PUTAWAY_FIXTURES } from './putaway.fixtures';

export type { FixtureHandler } from './fixture.types';

export const FIXTURES: Record<string, FixtureHandler> = {
  'GET /health': () => ok({ status: 'ok', mock: true }),
  ...AUTH_FIXTURES,
  ...RECOVERY_FIXTURES,
  ...PRODUCT_FIXTURES, ...PRICE_HISTORY_FIXTURES, ...auditWrap({ ...USER_FIXTURES, ...ROLE_FIXTURES, ...OVERRIDE_FIXTURES }), ...AUDIT_FIXTURES,
  ...SETTINGS_FIXTURES,
  ...ORG_FIXTURES,
  ...LABEL_FIXTURES,
  ...PURCHASE_FIXTURES,
  ...PAYABLES_FIXTURES,
  ...STOCK_FIXTURES,
  ...TRANSFER_FIXTURES,
  ...COUNT_FIXTURES,
  ...ADJUSTMENT_FIXTURES,
  ...RESERVATION_FIXTURES,
  ...PUTAWAY_FIXTURES,
  ...POS_FIXTURES,
  // POS ke customer routes ko wholesale wale (credit fields ke saath) override karte hain.
  ...SALES_FIXTURES,
  ...REPAIR_FIXTURES,
  ...REPORT_FIXTURES,
};
