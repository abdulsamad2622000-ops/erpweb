export type BarcodeKind = 'sku' | 'serial' | 'bin';
export type Symbology = 'code128' | 'ean13' | 'qr';
export type LabelField = 'title' | 'subtitle' | 'value' | 'price' | 'company';
export type PrintKind = 'print' | 'reprint';

export const BARCODE_KINDS: readonly BarcodeKind[] = ['sku', 'serial', 'bin'];
export const SYMBOLOGIES: readonly Symbology[] = ['code128', 'ean13', 'qr'];
export const LABEL_FIELDS: readonly LabelField[] = ['title', 'subtitle', 'value', 'price', 'company'];

/** Label printer ke aam sizes (mm). */
export const SIZE_PRESETS: readonly { key: string; widthMm: number; heightMm: number }[] = [
  { key: '50x25', widthMm: 50, heightMm: 25 },
  { key: '38x25', widthMm: 38, heightMm: 25 },
  { key: '70x40', widthMm: 70, heightMm: 40 },
  { key: '100x50', widthMm: 100, heightMm: 50 },
];

/** Ek cheez jis ka label ban sakta hai: SKU, serial ya bin. */
export interface LabelItem {
  id: string;
  kind: BarcodeKind;
  value: string;
  title: string;
  subtitle: string | null;
  price: number | null;
}

export interface LabelTemplate {
  id: number;
  name: string;
  widthMm: number;
  heightMm: number;
  symbology: Symbology;
  fields: LabelField[];
  showLogo: boolean;
  isDefault: boolean;
}

export type LabelTemplateInput = Omit<LabelTemplate, 'id'>;

export interface PrintLogEntry {
  id: number;
  at: string;
  userName: string;
  templateName: string;
  kind: PrintKind;
  reason: string | null;
  values: string[];
  labelCount: number;
}

export interface PrintLogInput {
  templateId: number;
  kind: PrintKind;
  reason: string | null;
  values: string[];
  labelCount: number;
}

/** Print queue ki ek line: item aur kitni copies. */
export interface QueueLine {
  item: LabelItem;
  copies: number;
}
