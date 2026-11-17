import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ThemeService } from './core/theme/theme.service';
import { ConfirmDialogComponent } from './shared/ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<p-toast position="top-center" /><router-outlet /><app-confirm-dialog />',
})
export class App {
  constructor() {
    inject(ThemeService);     // saved theme apply karo
  }
}
