import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('andar ka relative URL chalta hai', () => {
    expect(safeReturnUrl('/inventory/stock')).toBe('/inventory/stock');
  });

  it('khali ya null to dashboard', () => {
    expect(safeReturnUrl(null)).toBe('/dashboard');
    expect(safeReturnUrl('')).toBe('/dashboard');
  });

  it('bahar ke URL (open redirect) block', () => {
    expect(safeReturnUrl('https://evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('//evil.com')).toBe('/dashboard');
    expect(safeReturnUrl('/\\evil.com')).toBe('/dashboard');
  });

  it('login par wapas nahi bhejta', () => {
    expect(safeReturnUrl('/login?x=1')).toBe('/dashboard');
  });
});