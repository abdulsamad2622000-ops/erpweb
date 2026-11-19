import {
  BARCODE_KINDS,
  LABEL_FIELDS,
  LabelItem,
  LabelTemplate,
  LabelTemplateInput,
  PrintLogEntry,
  PrintLogInput,
  SYMBOLOGIES,
} from '../../../features/barcodes/models/barcode.models';
import { FixtureHandler, fail, ok } from './fixture.types';
import { paged } from './products.fixtures';

const ITEMS: LabelItem[] = [
  { id: 'sku-1', kind: 'sku', value: 'DL-LAT5440-I5', title: 'Dell Latitude 5440', subtitle: 'i5 / 16GB / 512GB SSD', price: 245000 },
  { id: 'sku-2', kind: 'sku', value: 'HP-PB450G10-I7', title: 'HP ProBook 450 G10', subtitle: 'i7 / 16GB / 512GB SSD', price: 289000 },
  { id: 'sku-3', kind: 'sku', value: 'LN-TP-E14-R5', title: 'Lenovo ThinkPad E14', subtitle: 'Ryzen 5 / 8GB / 256GB', price: 198000 },
  { id: 'ser-1', kind: 'serial', value: 'CN0X7K2L8D', title: 'Dell Latitude 5440', subtitle: 'Serial', price: 245000 },
  { id: 'ser-2', kind: 'serial', value: 'CN0X7K2L9F', title: 'Dell Latitude 5440', subtitle: 'Serial', price: 245000 },
  { id: 'ser-3', kind: 'serial', value: '5CG3401XYZ', title: 'HP ProBook 450 G10', subtitle: 'Serial', price: 289000 },
  { id: 'ser-4', kind: 'serial', value: 'PF4A9TQ2', title: 'Lenovo ThinkPad E14', subtitle: 'Serial', price: 198000 },
  { id: 'bin-1', kind: 'bin', value: 'KHI-A-01-02-03', title: 'Karachi Main', subtitle: 'Zone A / Rack 01 / Shelf 02 / Bin 03', price: null },
  { id: 'bin-2', kind: 'bin', value: 'KHI-A-01-02-04', title: 'Karachi Main', subtitle: 'Zone A / Rack 01 / Shelf 02 / Bin 04', price: null },
];

let templates: LabelTemplate[] = [
  { id: 1, name: 'Product 50x25', widthMm: 50, heightMm: 25, symbology: 'code128', fields: ['title', 'value', 'price'], showLogo: false, isDefault: true },
  { id: 2, name: 'Serial 38x25', widthMm: 38, heightMm: 25, symbology: 'code128', fields: ['title', 'value'], showLogo: false, isDefault: false },
  { id: 3, name: 'Bin QR 70x40', widthMm: 70, heightMm: 40, symbology: 'qr', fields: ['title', 'subtitle', 'value'], showLogo: false, isDefault: false },
];

const log: PrintLogEntry[] = [
  {
    id: 1, at: '2026-11-18T10:15:00.000Z', userName: 'Demo Store Keeper', templateName: 'Serial 38x25',
    kind: 'print', reason: null, values: ['CN0X7K2L8D', 'CN0X7K2L9F'], labelCount: 2,
  },
];

let nextTemplateId = 4;
let nextLogId = 2;

const idOf = (url: string): number => Number(url.split('?')[0].split('/').pop());

/** Template ki jaanch. Ghalti ka paigham ya null. */
export function templateError(b: LabelTemplateInput, ignoreId = 0): string | null {
  if (!b?.name?.trim()) return 'Template name is required.';
  if (templates.some((t) => t.id !== ignoreId && t.name.toLowerCase() === b.name.trim().toLowerCase())) {
    return 'A template with this name already exists.';
  }
  if (!(b.widthMm >= 20 && b.widthMm <= 150) || !(b.heightMm >= 10 && b.heightMm <= 150)) {
    return 'Label size must be 20–150 mm wide and 10–150 mm high.';
  }
  if (!SYMBOLOGIES.includes(b.symbology)) return 'Choose a valid barcode type.';
  if (!Array.isArray(b.fields) || b.fields.some((f) => !LABEL_FIELDS.includes(f))) return 'Invalid label fields.';
  return null;
}

function saveTemplate(b: LabelTemplateInput, id: number): LabelTemplate {
  const t: LabelTemplate = { ...b, name: b.name.trim(), id };
  if (t.isDefault) templates = templates.map((x) => ({ ...x, isDefault: false }));
  templates = id === 0 ? [...templates] : templates.filter((x) => x.id !== id);
  return t;
}

export const LABEL_FIXTURES: Record<string, FixtureHandler> = {
  'GET /labels/items': (req) => {
    const kind = new URL(req.url, 'http://mock').searchParams.get('kind');
    const rows = BARCODE_KINDS.includes(kind as LabelItem['kind']) ? ITEMS.filter((i) => i.kind === kind) : ITEMS;
    return ok(paged(rows, req.url, (r) => `${r.value} ${r.title} ${r.subtitle ?? ''}`));
  },
  'GET /labels/lookup': (req) => {
    const value = (new URL(req.url, 'http://mock').searchParams.get('value') ?? '').trim().toLowerCase();
    const item = ITEMS.find((i) => i.value.toLowerCase() === value);
    return item ? ok(item) : fail(404, 'No serial, SKU or bin found for this barcode.');
  },
  'GET /labels/templates': () => ok(templates),
  'POST /labels/templates': (req) => {
    const b = req.body as LabelTemplateInput;
    const err = templateError(b);
    if (err) return fail(422, err);
    const t = saveTemplate(b, 0);
    t.id = nextTemplateId++;
    templates = [...templates, t];
    return ok(t);
  },
  'PUT /labels/templates/:id': (req) => {
    const id = idOf(req.url);
    if (!templates.some((t) => t.id === id)) return fail(404, 'Template not found.');
    const b = req.body as LabelTemplateInput;
    const err = templateError(b, id);
    if (err) return fail(422, err);
    const t = saveTemplate(b, id);
    templates = [...templates, t].sort((a, c) => a.id - c.id);
    return ok(t);
  },
  'DELETE /labels/templates/:id': (req) => {
    const id = idOf(req.url);
    const t = templates.find((x) => x.id === id);
    if (!t) return fail(404, 'Template not found.');
    if (t.isDefault) return fail(409, 'The default template cannot be deleted.');
    templates = templates.filter((x) => x.id !== id);
    return ok(null);
  },
  'GET /labels/print-log': (req) => {
    const newestFirst = [...log].sort((a, b) => b.at.localeCompare(a.at));
    return ok(paged(newestFirst, req.url, (r) => `${r.values.join(' ')} ${r.userName} ${r.templateName} ${r.reason ?? ''}`));
  },
  'POST /labels/print-log': (req) => {
    const b = req.body as PrintLogInput;
    const tpl = templates.find((t) => t.id === b?.templateId);
    if (!tpl) return fail(422, 'Choose a label template.');
    if (!b.values?.length || !(b.labelCount > 0)) return fail(422, 'Nothing to print.');
    if (b.kind === 'reprint' && (b.reason ?? '').trim().length < 10) {
      return fail(422, 'A reason of at least 10 characters is required to reprint.');
    }
    const entry: PrintLogEntry = {
      id: nextLogId++, at: new Date().toISOString(), userName: 'Current user', templateName: tpl.name,
      kind: b.kind, reason: b.kind === 'reprint' ? (b.reason ?? '').trim() : null, values: [...b.values], labelCount: b.labelCount,
    };
    log.push(entry);
    return ok(entry);
  },
};
