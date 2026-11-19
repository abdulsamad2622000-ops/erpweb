import { ROLE_FIXTURES, USER_FIXTURES } from './users.fixtures';
// Sab fixtures isi folder mein (baad mein remove karna aasan)
import { AUTH_FIXTURES } from './auth.fixtures';
import { FixtureHandler, ok } from './fixture.types';
import { PRODUCT_FIXTURES } from './products.fixtures';
import { RECOVERY_FIXTURES } from './recovery.fixtures';

export type { FixtureHandler } from './fixture.types';

export const FIXTURES: Record<string, FixtureHandler> = {
  'GET /health': () => ok({ status: 'ok', mock: true }),
  ...AUTH_FIXTURES,
  ...RECOVERY_FIXTURES,
  ...PRODUCT_FIXTURES, ...USER_FIXTURES, ...ROLE_FIXTURES,
};
