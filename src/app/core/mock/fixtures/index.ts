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

export type { FixtureHandler } from './fixture.types';

export const FIXTURES: Record<string, FixtureHandler> = {
  'GET /health': () => ok({ status: 'ok', mock: true }),
  ...AUTH_FIXTURES,
  ...RECOVERY_FIXTURES,
  ...PRODUCT_FIXTURES, ...PRICE_HISTORY_FIXTURES, ...auditWrap({ ...USER_FIXTURES, ...ROLE_FIXTURES, ...OVERRIDE_FIXTURES }), ...AUDIT_FIXTURES,
  ...SETTINGS_FIXTURES,
  ...ORG_FIXTURES,
  ...LABEL_FIXTURES,
};
