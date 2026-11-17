import { errorKey } from './error.interceptor';

describe('errorKey', () => {
  it('status ko sahi translation key par map karta hai', () => {
    expect(errorKey(0)).toBe('errors.network');
    expect(errorKey(401)).toBe('errors.unauthorized');
    expect(errorKey(403)).toBe('errors.forbidden');
    expect(errorKey(422)).toBe('errors.validation');
    expect(errorKey(500)).toBe('errors.server');
    expect(errorKey(418)).toBe('errors.generic');
  });
});