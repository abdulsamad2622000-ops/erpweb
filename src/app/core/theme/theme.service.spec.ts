import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    TestBed.resetTestingModule();
  });

  it('saved theme restore karta hai', () => {
    localStorage.setItem('erp.theme', 'dark');
    const s = TestBed.inject(ThemeService);
    expect(s.theme()).toBe('dark');
  });

  it('toggle se html par dark class lagti hai aur save hota hai', () => {
    localStorage.setItem('erp.theme', 'light');
    const s = TestBed.inject(ThemeService);
    s.toggle();
    TestBed.tick();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('erp.theme')).toBe('dark');
  });
});