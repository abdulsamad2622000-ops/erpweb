import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { MessageService } from 'primeng/api';
import { mockInterceptor } from './core/http/mock.interceptor';
import { apiBaseInterceptor } from './core/http/api-base.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { envelopeInterceptor } from './core/http/envelope.interceptor';
import { branchInterceptor } from './core/http/branch.interceptor';
import { provideTransloco } from '@jsverse/transloco';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { PRIMEUI_LICENSE } from './core/config/primeui-license';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { PwaService } from './core/pwa/pwa.service';
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([mockInterceptor, apiBaseInterceptor, branchInterceptor, envelopeInterceptor, errorInterceptor])),
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
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    // beforeinstallprompt jaldi aa jata hai, isliye service app start par bana lete hain.
    provideAppInitializer(() => {
      inject(PwaService);
    }),
  ],
};