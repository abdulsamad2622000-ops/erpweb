/** Code128 barcode ko SVG text bana kar deta hai. jsbarcode pehli dafa call par load hoti hai. */
export async function code128Svg(value: string): Promise<string> {
  const { default: JsBarcode } = await import('jsbarcode');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, value, {
    format: 'CODE128',
    width: 2,
    height: 48,
    margin: 0,
    displayValue: true,
    fontSize: 14,
  });
  const w = parseFloat(svg.getAttribute('width') ?? '0');
  const h = parseFloat(svg.getAttribute('height') ?? '0');
  if (w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', '100%');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  return svg.outerHTML;
}