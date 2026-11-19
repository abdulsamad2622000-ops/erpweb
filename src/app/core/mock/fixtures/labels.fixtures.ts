import { LabelItem, LabelKind, LabelTemplate, LabelTemplateInput, PrintLogEntry, PrintLogInput } from '../../../features/labels/models/label.models';
import { FixtureHandler, fail, ok } from './fixture.types';

const templates: LabelTemplate[] = [
  { id: 1, name: 'Laptop serial 62x32', kind: 'serial', widthMm: 62, heightMm: 32, symbology: 'code128', fields: ['name', 'specs', 'serial'], showLogo: false, isDefault: true },
  { id: 2, name: 'Shelf price 50x25', kind: 'sku', widthMm: 50, heightMm: 25, symbology: 'code128', fields: ['name', 'price'], showLogo: false, isDefault: true },
  { id: 3, name: 'Bin QR 50x25', kind: 'bin', widthMm: 50, heightMm: 25, symbology: 'qr', fields: ['bin', 'code'], showLogo: false, isDefault: true },
];

const item = (kind: LabelKind, code: string, o: Partial<LabelItem>): LabelItem => ({
  kind, code, name: '', sku: null, serial: null, specs: null, price: null, bin: null, grn: null, printCount: 0, ...o,
});
const dell = { name: 'Dell Latitude 5440', sku: 'DL-5440-I5', specs: 'i5 / 16GB / 512GB SSD' };
const hp = { name: 'HP ProBook 450 G10', sku: 'HP-450G10-I7', specs: 'i7 / 16GB / 1TB SSD' };

const items: LabelItem[] = [
  item('sku', 'DL-5440-I5', { ...dell, price: 165000 }),
  item('sku', 'HP-450G10-I7', { ...hp, price: 189000 }),
  item('sku', '8901234567890', { name: 'Logitech M90 Mouse', sku: 'LG-M90', price: 1800 }),
  ...['5CG3412XYZ', '5CG3412XYA', '5CG3412XYB'].map((s, i) =>
    item('serial', s, { ...dell, serial: s, bin: i < 2 ? 'A-03-2' : 'A-03-3', grn: 'GRN-0042' })),
  item('serial', '5CD2219HPQ', { ...hp, serial: '5CD2219HPQ', bin: 'B-01-1', grn: 'GRN-0041', printCount: 1 }),
  item('bin', 'BIN-A-03-2', { name: 'Main warehouse', bin: 'A-03-2' }),
  item('bin', 'BIN-A-03-3', { name: 'Main warehouse', bin: 'A-03-3' }),
];

const log: PrintLogEntry[] = [
  { id: 1, templateId: 1, templateName: 'Laptop serial 62x32', codes: ['5CD2219HPQ'], isReprint: false, reason: null, printedAt: '2026-11-10T09:00:00.000Z', printedBy: 'Demo Admin' },
];
let nextTemplateId = 10;
let nextLogId = 10;

const query = (url: string): URLSearchParams => new URLSearchParams(url.split('?')[1] ?? '');
const lastSegment = (url: string): string => decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');

function validTemplate(b: Partial<LabelTemplateInput> | null): string | null {
  if (!b?.name?.trim()) return 'Name is required.';
  if (!b.widthMm || !b.heightMm || b.widthMm < 20 || b.heightMm < 15 || b.widthMm > 150 || b.heightMm > 150) return 'Size must be 20–150 mm wide and 15–150 mm high.';
  if (!b.fields?.length) return 'Pick at least one field.';
  return null;
}

function applyDefault(t: LabelTemplate): void {
  if (t.isDefault) templates.forEach((x) => { if (x.id !== t.id && x.kind === t.kind) x.isDefault = false; });
}

/** Posted GRN ke serials label list mein (mock). */
export function addLabelItems(list: LabelItem[]): void {
  for (const i of list) if (!items.some((x) => x.code === i.code)) items.push(i);
}

export function labelGrns(): string[] {
  return [...new Set(items.map((i) => i.grn).filter((g): g is string => !!g))].sort();
}

export const LABEL_FIXTURES: Record<string, FixtureHandler> = {
  'GET /labels/templates': () => ok(templates),
  'POST /labels/templates': (req) => {
    const b = req.body as LabelTemplateInput;
    const err = validTemplate(b);
    if (err) return fail(422, err);
    const t: LabelTemplate = { ...b, name: b.name.trim(), id: nextTemplateId++ };
    templates.push(t);
    applyDefault(t);
    return ok(t);
  },
  'PUT /labels/templates/:id': (req) => {
    const t = templates.find((x) => x.id === Number(lastSegment(req.url)));
    if (!t) return fail(404, 'Template not found.');
    const b = req.body as LabelTemplateInput;
    const err = validTemplate(b);
    if (err) return fail(422, err);
    Object.assign(t, b, { name: b.name.trim() });
    applyDefault(t);
    return ok(t);
  },
  'GET /labels/items': (req) => {
    const p = query(req.url);
    const q = (p.get('q') ?? '').trim().toLowerCase();
    const grn = p.get('grn') ?? '';
    return ok(items.filter((i) =>
      i.kind === p.get('kind') &&
      (!grn || i.grn === grn) &&
      (!q || [i.code, i.name, i.sku, i.serial, i.bin].some((v) => v?.toLowerCase().includes(q)))));
  },
  'GET /labels/lookup/:id': (req) => {
    const code = lastSegment(req.url).trim().toUpperCase();
    const found = items.find((i) => i.code.toUpperCase() === code || i.serial?.toUpperCase() === code);
    return found ? ok(found) : fail(404, 'No serial, SKU or bin matches this code.');
  },
  'GET /labels/grns': () => ok(labelGrns()),
  'GET /labels/print-log': () => ok([...log].sort((a, b) => b.printedAt.localeCompare(a.printedAt))),
  'POST /labels/print-log': (req) => {
    const b = req.body as PrintLogInput;
    const t = templates.find((x) => x.id === b?.templateId);
    if (!t || !b.codes?.length) return fail(422, 'Template and at least one label are required.');
    const printed = items.filter((i) => b.codes.includes(i.code));
    const isReprint = printed.some((i) => i.printCount > 0);
    if (isReprint && (b.reason?.trim().length ?? 0) < 10) return fail(422, 'A reason is required to reprint labels.');
    printed.forEach((i) => i.printCount++);
    const entry: PrintLogEntry = {
      id: nextLogId++, templateId: t.id, templateName: t.name, codes: b.codes, isReprint,
      reason: isReprint ? b.reason!.trim() : null, printedAt: new Date().toISOString(), printedBy: 'Mock user',
    };
    log.push(entry);
    return ok(entry);
  },
};
