import { errorKey, isScanUrl, shouldToast } from './error.interceptor';

describe('errorKey', () => {
  it('status ko sahi translation key par map karta hai', () => {
    expect(errorKey(0)).toBe('errors.network');
    expect(errorKey(401)).toBe('errors.unauthorized');
    expect(errorKey(403)).toBe('errors.forbidden');
    expect(errorKey(419)).toBe('errors.csrf');
    expect(errorKey(422)).toBe('errors.validation');
    expect(errorKey(500)).toBe('errors.server');
    expect(errorKey(418)).toBe('errors.generic');
  });
});

describe('scan routes and the error toast', () => {
  it('knows which urls are scan screens', () => {
    expect(isScanUrl('/scan')).toBe(true);
    expect(isScanUrl('/scan/counts/3')).toBe(true);
    expect(isScanUrl('/scan?x=1')).toBe(true);
    expect(isScanUrl('/scanner-settings')).toBe(false);
    expect(isScanUrl('/inventory/counts')).toBe(false);
  });

  it('is silent for no-connection errors on scan screens only', () => {
    expect(shouldToast(0, '/scan/counts')).toBe(false);
    expect(shouldToast(0, '/inventory/stock')).toBe(true);
    expect(shouldToast(500, '/scan/counts')).toBe(true);
    expect(shouldToast(422, '/inventory/stock')).toBe(false);
  });
});