export const CURRENCIES = ['PKR', 'USD', 'AED', 'SAR', 'EUR', 'GBP'] as const;

export interface CompanyProfile {
  name: string;
  logo: string | null;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  taxNumber: string;
  taxRate: number;
  currency: string;
}

export type NumberSeriesCode = 'PO' | 'GRN' | 'INVOICE';

export interface NumberSeries {
  id: number;
  code: NumberSeriesCode;
  prefix: string;
  nextNumber: number;
  padding: number;
  resetYearly: boolean;
}
export type NumberSeriesInput = Omit<NumberSeries, 'id' | 'code'>;

export function formatSeries(s: Pick<NumberSeries, 'prefix' | 'nextNumber' | 'padding'>): string {
  return `${s.prefix}${String(s.nextNumber).padStart(s.padding, '0')}`;
}

export type PriceTierCode = 'retail' | 'wholesale' | 'dealer';

export interface PriceTier {
  id: number;
  code: PriceTierCode;
  name: string;
  isActive: boolean;
}
export type PriceTierInput = Omit<PriceTier, 'id' | 'code'>;

export type CostingMethod = 'fifo' | 'weighted_average' | 'serial_specific';
export type NegativeStockRule = 'block' | 'warn' | 'allow';

export interface CostingSettings {
  method: CostingMethod;
  negativeStock: NegativeStockRule;
}

export interface BackupInfo {
  status: 'ok' | 'failed' | 'never';
  lastBackupAt: string | null;
  frequency: 'daily' | 'weekly';
  time: string;
  retentionDays: number;
  location: string;
}