import { LabelItem, LabelKind } from '../models/label.models';

/** Template designer ke live preview ke liye namoona data. */
export const SAMPLE_ITEMS: Record<LabelKind, LabelItem> = {
  serial: {
    kind: 'serial', code: '5CG3412XYZ', name: 'Dell Latitude 5440', sku: 'DL-5440-I5', serial: '5CG3412XYZ',
    specs: 'i5 / 16GB / 512GB SSD', price: 165000, bin: 'A-03-2', grn: 'GRN-0042', printCount: 0,
  },
  sku: {
    kind: 'sku', code: '8901234567890', name: 'Logitech M90 Mouse', sku: 'LG-M90', serial: null,
    specs: null, price: 1800, bin: null, grn: null, printCount: 0,
  },
  bin: {
    kind: 'bin', code: 'BIN-A-03-2', name: 'Main warehouse', sku: null, serial: null,
    specs: null, price: null, bin: 'A-03-2', grn: null, printCount: 0,
  },
};
