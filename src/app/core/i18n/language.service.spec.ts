import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  const setActiveLang = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    setActiveLang.mockClear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: TranslocoService, useValue: { setActiveLang } }],
    });
  });

  it('urdu par dir=rtl aur lang=ur set hota hai', () => {
    const s = TestBed.inject(LanguageService);
    s.set('ur');
    TestBed.tick();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ur');
    expect(localStorage.getItem('erp.lang')).toBe('ur');
  });

  it('english par dir=ltr wapas aata hai', () => {
    const s = TestBed.inject(LanguageService);
    s.set('ur');
    TestBed.tick();
    s.set('en');
    TestBed.tick();
    expect(document.documentElement.dir).toBe('ltr');
  });
});