import { FixtureHandler, ok } from './fixture.types';

// Real backend ki tarah hamesha generic jawab
export const RECOVERY_FIXTURES: Record<string, FixtureHandler> = {
  'POST /auth/forgot-password': () => ok(),
  'POST /auth/recover-email': () => ok(),
};