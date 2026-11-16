import { MENU, flattenMenu } from './menu.config';

describe('menu config', () => {
  it('har item par permission key module.resource.action jaisi hai', () => {
    for (const item of flattenMenu()) {
      expect(item.permission.split('.').length).toBeGreaterThanOrEqual(2);
    }
  });

  it('out-of-scope items (accessories, bundle, kit, service) menu mein nahi', () => {
    const keys = flattenMenu().map((i) => i.key.toLowerCase());
    for (const banned of ['accessor', 'bundle', 'kit', 'service']) {
      expect(keys.some((k) => k.includes(banned))).toBe(false);
    }
  });

  it('website menu flag se guarded hai', () => {
    expect(MENU.find((i) => i.key === 'website')?.flag).toBe('website');
  });
});