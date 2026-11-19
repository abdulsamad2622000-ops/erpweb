import { describe, expect, it } from 'vitest';
import { barcodeSvg, ean13CheckDigit, validateValue } from './barcode-render';

describe('barcode-render', () => {
  it('calculates the EAN-13 check digit', () => {
    expect(ean13CheckDigit('590123412345')).toBe(7);
    expect(ean13CheckDigit('400638133393')).toBe(1);
  });

  it('validates values per barcode type', () => {
    expect(validateValue('', 'code128')).toBe('barcodes.errors.empty');
    expect(validateValue('CN0X7K2L8D', 'code128')).toBeNull();
    expect(validateValue('ÄÖÜ', 'code128')).toBe('barcodes.errors.code128');
    expect(validateValue('590123412345', 'ean13')).toBeNull();
    expect(validateValue('5901234123457', 'ean13')).toBeNull();
    expect(validateValue('5901234123458', 'ean13')).toBe('barcodes.errors.eanCheck');
    expect(validateValue('ABC', 'ean13')).toBe('barcodes.errors.eanFormat');
    expect(validateValue('x'.repeat(501), 'qr')).toBe('barcodes.errors.tooLong');
  });

  it('renders Code 128, EAN-13 and QR as SVG', async () => {
    expect(await barcodeSvg('CN0X7K2L8D', 'code128')).toContain('<svg');
    expect(await barcodeSvg('590123412345', 'ean13')).toContain('<svg');
    expect(await barcodeSvg('KHI-A-01-02-03', 'qr')).toContain('<svg');
  });

  it('rejects an invalid value', async () => {
    await expect(barcodeSvg('12', 'ean13')).rejects.toThrow('barcodes.errors.eanFormat');
  });
});
