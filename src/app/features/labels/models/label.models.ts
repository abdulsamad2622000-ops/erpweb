export type Symbology = 'code128' | 'qr' | 'ean13';
export type LabelKind = 'sku' | 'serial' | 'bin';
export type LabelField = 'company' | 'name' | 'sku' | 'serial' | 'specs' | 'price' | 'bin' | 'code';

export interface LabelTemplate {
  id: number;
  name: string;
  kind: LabelKind;
  widthMm: number;
  heightMm: number;
  symbology: Symbology;
  fields: LabelField[];
  showLogo: boolean;
  isDefault: boolean;
}

export type LabelTemplateInput = Omit<LabelTemplate, 'id'>;

/** Ek printable cheez: product SKU, ek serial ya ek bin. */
export interface LabelItem {
  kind: LabelKind;
  /** Barcode mein yahi value jati hai. */
  code: string;
  name: string;
  sku: string | null;
  serial: string | null;
  specs: string | null;
  price: number | null;
  bin: string | null;
  /** Kis GRN se aaya (sirf serials). */
  grn: string | null;
  /** Kitni dafa print ho chuka. 0 = kabhi nahi. */
  printCount: number;
}

export interface PrintLogEntry {
  id: number;
  templateId: number;
  templateName: string;
  codes: string[];
  isReprint: boolean;
  reason: string | null;
  printedAt: string;
  printedBy: string;
}

export interface PrintLogInput {
  templateId: number;
  codes: string[];
  reason: string | null;
}
