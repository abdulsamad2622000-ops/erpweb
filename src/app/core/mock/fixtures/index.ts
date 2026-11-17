// Sab fixtures isi folder mein (baad mein remove karna aasan)
import { AUTH_FIXTURES } from './auth.fixtures';
import { FixtureHandler, ok } from './fixture.types';

export type { FixtureHandler } from './fixture.types';

export const FIXTURES: Record<string, FixtureHandler> = {
  'GET /health': () => ok({ status: 'ok', mock: true }),
  ...AUTH_FIXTURES,
};