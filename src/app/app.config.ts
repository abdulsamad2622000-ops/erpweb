import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { mockInterceptor } from './core/http/mock.interceptor';
import { apiBaseInterceptor } from './core/http/api-base.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { branchInterceptor } from './core/http/branch.interceptor';
import { provideTransloco } from '@jsverse/transloco';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { PRIMEUI_LICENSE } from './core/config/primeui-license';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([mockInterceptor, apiBaseInterceptor, branchInterceptor, errorInterceptor])),
    MessageService,
    provideTransloco({
      config: {
        availableLangs: ['en'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    providePrimeNG({
      theme: { preset: Aura, options: { darkModeSelector: '.dark' } },
      license: PRIMEUI_LICENSE,
    }),
  ],
};