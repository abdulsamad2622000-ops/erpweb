import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p-toast position="top-center" /><router-outlet />',
})
export class App {
  constructor() {
    inject(ThemeService);     // saved theme apply karo
    inject(LanguageService);  // saved language + dir apply karo
  }
}