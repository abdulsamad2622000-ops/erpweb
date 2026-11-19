import { Injectable } from '@angular/core';
import { PaperSize, buildPrintDocument } from './print-utils';

export interface PrintOptions {
  title: string;
  /** Escape shuda HTML (escapeHtml se). */
  body: string;
  paper: PaperSize;
  dir?: 'ltr' | 'rtl';
  /** Mazeed CSS, e.g. label ka @page size. Sirf hamara apna CSS, user text nahi. */
  extraCss?: string;
}

/** Chhupe iframe mein document bana kar browser print dialog kholta hai. */
@Injectable({ providedIn: 'root' })
export class PrintService {
  print(options: PrintOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      iframe.style.cssText = 'position:fixed;inset-inline-start:-9999px;width:0;height:0;border:0';

      let done = false;
      const cleanup = (): void => {
        if (done) return;
        done = true;
        iframe.remove();
        resolve();
      };

      iframe.onload = () => {
        const win = iframe.contentWindow;
        if (!win) {
          cleanup();
          return;
        }
        win.addEventListener('afterprint', cleanup);
        win.focus();
        win.print();
        // Kuch browsers afterprint nahi bhejte.
        setTimeout(cleanup, 60_000);
      };

      iframe.srcdoc = buildPrintDocument(options.title, options.body, options.paper, options.dir, options.extraCss);
      document.body.appendChild(iframe);
    });
  }
}
