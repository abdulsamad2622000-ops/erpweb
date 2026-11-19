import { Symbology } from '../models/barcode.models';

/** EAN-13 ka check digit (pehle 12 digits se). */
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** Value is symbology mein ban sakti hai? Na ho to error key deta hai. */
export function validateValue(value: string, symbology: Symbology): string | null {
  const v = value.trim();
  if (!v) return 'barcodes.errors.empty';
  if (symbology === 'ean13') {
    if (!/^\d{12,13}$/.test(v)) return 'barcodes.errors.eanFormat';
    if (v.length === 13 && ean13CheckDigit(v.slice(0, 12)) !== Number(v[12])) return 'barcodes.errors.eanCheck';
    return null;
  }
  if (symbology === 'code128') {
    // Code128 sirf ASCII 32-126 chhap sakta hai
    return /^[\x20-\x7E]+$/.test(v) ? null : 'barcodes.errors.code128';
  }
  return v.length <= 500 ? null : 'barcodes.errors.tooLong';
}

function normaliseSvg(svg: SVGSVGElement): string {
  const w = parseFloat(svg.getAttribute('width') ?? '0');
  const h = parseFloat(svg.getAttribute('height') ?? '0');
  if (w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.removeAttribute('style');
  return svg.outerHTML;
}

/**
 * Barcode ka SVG text. Libraries pehli dafa call par load hoti hain (main bundle halka rehta hai).
 * Ghalat value par Error phenkta hai; pehle validateValue chalayein.
 */
export async function barcodeSvg(value: string, symbology: Symbology): Promise<string> {
  const err = validateValue(value, symbology);
  if (err) throw new Error(err);
  const v = value.trim();

  if (symbology === 'qr') {
    const QRCode = await import('qrcode');
    return QRCode.toString(v, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  }

  const { default: JsBarcode } = await import('jsbarcode');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, symbology === 'ean13' ? v.slice(0, 12) : v, {
    format: symbology === 'ean13' ? 'EAN13' : 'CODE128',
    width: 2,
    height: 50,
    margin: 0,
    displayValue: false,
  });
  return normaliseSvg(svg);
}
