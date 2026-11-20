import { LabelItem, LabelTemplate } from '../models/label.models';
import { renderBarcodeSvg } from './barcode-render';
import { LabelSheetOptions, buildLabelSheet } from './label-utils';

/** Barcodes bana kar poori label sheet ka HTML deta hai. */
export async function renderLabelSheet(
  template: LabelTemplate,
  items: readonly LabelItem[],
  opts: LabelSheetOptions,
): Promise<string> {
  const svgs = await Promise.all(items.map((i) => renderBarcodeSvg(i.code, template.symbology)));
  return buildLabelSheet(template, items, svgs, opts);
}

export const moneyPkr = (n: number): string => 'Rs ' + n.toLocaleString('en-PK');
