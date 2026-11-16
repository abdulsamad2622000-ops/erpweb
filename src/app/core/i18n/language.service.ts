import { Injectable, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type Lang = 'en' | 'ur';
const KEY = 'erp.lang'; // sirf UI preference

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  readonly lang = signal<Lang>(this.initial());
  readonly dir = () => (this.lang() === 'ur' ? 'rtl' : 'ltr');

  constructor() {
    effect(() => {
      const l = this.lang();
      this.transloco.setActiveLang(l);
      document.documentElement.lang = l;
      document.documentElement.dir = this.dir();
      localStorage.setItem(KEY, l);
    });
  }

  set(lang: Lang): void {
    this.lang.set(lang);
  }

  private initial(): Lang {
    return localStorage.getItem(KEY) === 'ur' ? 'ur' : 'en';
  }
}