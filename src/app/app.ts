import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/theme/theme.service';
import { ShellComponent } from './layout/shell.component';

@Component({
  selector: 'app-root',
  imports: [ShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-shell />',
})
export class App {
  constructor() {
    inject(ThemeService);     // saved theme apply karo
    inject(LanguageService);  // saved language + dir apply karo
  }
}