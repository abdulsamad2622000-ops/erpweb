import {
  BackupInfo,
  CURRENCIES,
  CompanyProfile,
  CostingSettings,
  NumberSeries,
  NumberSeriesInput,
  PriceTier,
  PriceTierInput,
} from '../../../features/settings/models/settings.models';
import { FixtureHandler, fail, ok } from './fixture.types';

let company: CompanyProfile = {
  name: 'Demo Computers',
  logo: null,
  address: 'Shop 12, Main Boulevard',
  city: 'Lahore',
  country: 'Pakistan',
  phone: '+92 42 111 000 111',
  email: 'info@democomputers.test',
  taxNumber: '1234567-8',
  taxRate: 18,
  currency: 'PKR',
};

const series: NumberSeries[] = [
  { id: 1, code: 'PO', prefix: 'PO-', nextNumber: 1, padding: 6, resetYearly: false },
  { id: 2, code: 'GRN', prefix: 'GRN-', nextNumber: 1, padding: 6, resetYearly: false },
  { id: 3, code: 'INVOICE', prefix: 'INV-', nextNumber: 1, padding: 6, resetYearly: true },
];

const tiers: PriceTier[] = [
  { id: 1, code: 'retail', name: 'Retail', isActive: true },
  { id: 2, code: 'wholesale', name: 'Wholesale', isActive: true },
  { id: 3, code: 'dealer', name: 'Dealer', isActive: true },
];

let costing: CostingSettings = { method: 'fifo', negativeStock: 'block' };

const backup: BackupInfo = {
  status: 'ok',
  lastBackupAt: '2026-11-18T22:00:00.000Z',
  frequency: 'daily',
  time: '22:00',
  retentionDays: 30,
  location: 'Server storage (managed by the hosting team)',
};

const idOf = (url: string): number => Number(url.split('?')[0].split('/').pop());
const isEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const SETTINGS_FIXTURES: Record<string, FixtureHandler> = {
  'GET /settings/company': () => ok(company),
  'PUT /settings/company': (req) => {
    const b = req.body as CompanyProfile;
    if (!b.name?.trim()) return fail(422, 'Company name is required.');
    if (b.email && !isEmail(b.email)) return fail(422, 'Enter a valid email address.');
    if (!(b.taxRate >= 0 && b.taxRate <= 100)) return fail(422, 'Tax rate must be between 0 and 100.');
    if (!CURRENCIES.includes(b.currency as (typeof CURRENCIES)[number])) return fail(422, 'Choose a valid currency.');
    company = { ...b, name: b.name.trim() };
    return ok(company);
  },

  'GET /settings/number-series': () => ok(series),
  'PUT /settings/number-series/:id': (req) => {
    const id = idOf(req.url);
    const i = series.findIndex((s) => s.id === id);
    if (i < 0) return fail(404, 'Not found.');
    const b = req.body as NumberSeriesInput;
    if (!/^[A-Za-z0-9\-_/]{1,12}$/.test(b.prefix ?? '')) {
      return fail(422, 'Prefix can use letters, digits, - _ / (max 12 characters).');
    }
    if (series.some((s) => s.id !== id && s.prefix.toLowerCase() === b.prefix.toLowerCase())) {
      return fail(422, 'This prefix is already used by another series.');
    }
    if (!Number.isInteger(b.nextNumber) || b.nextNumber < 1) return fail(422, 'Next number must be 1 or more.');
    if (!Number.isInteger(b.padding) || b.padding < 3 || b.padding > 10) {
      return fail(422, 'Digits must be between 3 and 10.');
    }
    series[i] = { ...series[i], ...b };
    return ok(series[i]);
  },

  'GET /settings/price-tiers': () => ok(tiers),
  'PUT /settings/price-tiers/:id': (req) => {
    const id = idOf(req.url);
    const i = tiers.findIndex((t) => t.id === id);
    if (i < 0) return fail(404, 'Not found.');
    const b = req.body as PriceTierInput;
    const name = (b.name ?? '').trim();
    if (!name) return fail(422, 'Tier name is required.');
    if (name.length > 50) return fail(422, 'Tier name is too long.');
    if (tiers.some((t) => t.id !== id && t.name.toLowerCase() === name.toLowerCase())) {
      return fail(422, 'This name already exists.');
    }
    if (tiers[i].code === 'retail' && !b.isActive) return fail(422, 'The retail tier cannot be disabled.');
    tiers[i] = { ...tiers[i], name, isActive: b.isActive };
    return ok(tiers[i]);
  },

  'GET /settings/costing': () => ok(costing),
  'PUT /settings/costing': (req) => {
    const b = req.body as CostingSettings;
    if (!['fifo', 'weighted_average', 'serial_specific'].includes(b.method)) {
      return fail(422, 'Choose a valid costing method.');
    }
    if (!['block', 'warn', 'allow'].includes(b.negativeStock)) {
      return fail(422, 'Choose a valid negative-stock rule.');
    }
    costing = { ...b };
    return ok(costing);
  },

  'GET /settings/backup': () => ok(backup),
};