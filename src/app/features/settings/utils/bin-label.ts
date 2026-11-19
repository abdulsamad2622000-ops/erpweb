import { escapeHtml } from '../../../shared/ui/print/print-utils';

export interface BinLabel {
  title: string;
  caption: string;
  /** code128Svg() ka output; yahi file ke bahar escape nahi hota. */
  svg: string;
}

const CSS =
  '<style>.sheet{display:flex;flex-wrap:wrap;gap:4mm}' +
  '.label{width:62mm;height:32mm;border:1px dashed #999;padding:2mm;display:flex;' +
  'flex-direction:column;justify-content:space-between;break-inside:avoid;overflow:hidden}' +
  '.label .cap{font-size:9px;text-align:center;line-height:1.2}' +
  '.label .bc{display:flex;align-items:center;justify-content:center;flex:1}</style>';

export function buildBinLabelSheet(labels: readonly BinLabel[]): string {
  const cells = labels
    .map(
      (l) =>
        `<div class="label"><div class="cap b">${escapeHtml(l.title)}</div>` +
        `<div class="bc">${l.svg}</div><div class="cap muted">${escapeHtml(l.caption)}</div></div>`,
    )
    .join('');
  return `${CSS}<div class="sheet">${cells}</div>`;
}