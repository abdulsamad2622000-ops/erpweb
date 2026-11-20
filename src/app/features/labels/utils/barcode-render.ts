import { Symbology } from '../models/label.models';
import { effectiveSymbology } from './label-utils';

/** Barcode SVG text. Libraries pehli call par lazy load hoti hain. */
export async function renderBarcodeSvg(value: string, wanted: Symbology): Promise<string> {
  const symbology = effectiveSymbology(wanted, value);
  if (symbology === 'qr') {
    const QRCode = await import('qrcode');
    return QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  }
  const { default: JsBarcode } = await import('jsbarcode');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, {
    format: symbology === 'ean13' ? 'EAN13' : 'CODE128',
    width: 2,
    height: 40,
    margin: 0,
    displayValue: true,
    fontSize: 12,
  });
  const w = parseFloat(svg.getAttribute('width') ?? '0');
  const h = parseFloat(svg.getAttribute('height') ?? '0');
  if (w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  return svg.outerHTML;
}
