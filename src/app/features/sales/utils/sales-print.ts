import { TranslocoService } from '@jsverse/transloco';
import { PrintService } from '../../../shared/ui/print/print.service';
import { docPrintHtml } from './sales-utils';

/** A4 document print (quotation / order / challan / invoice) translations ke saath. */
export function printDoc(
  printer: PrintService,
  i18n: TranslocoService,
  o: { titleKey: string; number: string; date: string; party: string; total: number | null; footer?: string;
    rows: { name: string; detail: string; qty: number; price: number | null }[] },
): void {
  const t = (k: string): string => i18n.translate(k);
  void printer.print({
    title: o.number,
    paper: 'a4',
    body: docPrintHtml({
      title: t(o.titleKey), number: o.number, date: o.date, party: o.party, rows: o.rows, total: o.total, footer: o.footer ?? '',
      labels: { item: t('posPage.item'), qty: t('posPage.qty'), price: t('posPage.price'), amount: t('posPage.amount'), total: t('posPage.total') },
    }),
  });
}

export const newKey = (): string => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
