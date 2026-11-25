import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-auth-card',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth-scope auth-bg relative min-h-dvh overflow-x-hidden">
      <svg class="auth-waves" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="wv1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#1D4ED8" stop-opacity=".55" /><stop offset="1" stop-color="#4F46E5" stop-opacity=".15" />
          </linearGradient>
          <linearGradient id="wv2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#6D5BFF" stop-opacity=".55" /><stop offset="1" stop-color="#1E3A8A" stop-opacity=".1" />
          </linearGradient>
        </defs>
        <path d="M0 520 C220 420 420 640 700 600 C960 560 1100 700 1440 640 L1440 900 L0 900 Z" fill="url(#wv1)" />
        <path d="M0 0 C260 60 330 200 220 330 C120 440 0 400 0 400 Z" fill="url(#wv2)" />
        <path d="M1440 80 C1280 140 1230 300 1330 420 C1390 490 1440 480 1440 480 Z" fill="url(#wv2)" />
        <path d="M0 700 C300 640 520 800 820 760 C1100 720 1260 820 1440 780 L1440 900 L0 900 Z" fill="url(#wv2)" opacity=".7" />
      </svg>

      <button type="button"
        class="auth-toggle absolute end-3 top-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-text focus-visible:outline-2 focus-visible:outline-accent sm:end-4 sm:top-4"
        [attr.aria-label]="'common.theme' | transloco" (click)="theme.toggle()">
        <i [class]="theme.theme() === 'dark' ? 'pi pi-sun' : 'pi pi-moon'" aria-hidden="true"></i>
      </button>

      <div class="relative mx-auto grid min-h-dvh max-w-6xl content-center items-center gap-6 px-4 pb-8 pt-16 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-10 lg:py-10">
        <aside class="flex flex-col items-center text-center" aria-hidden="true">
          <div class="flex items-center gap-3 text-3xl font-bold text-text lg:text-5xl">
            <img src="/brand-logo.svg" alt="" aria-hidden="true" class="brand-logo" />
            <span>Laptop <span class="auth-erp">ERP</span></span>
          </div>
          <p class="mt-2 text-sm text-muted sm:text-base lg:mt-3 lg:text-lg">Smarter Business. Better Management.</p>
          <div class="mt-3 h-1 w-24 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] lg:w-28"></div>

          <div class="relative mt-10 hidden w-full max-w-lg lg:block">
            <div class="auth-tile" style="left:2%;top:4%"><i class="pi pi-briefcase"></i></div>
            <div class="auth-tile" style="left:58%;top:-2%;animation-delay:.6s"><i class="pi pi-users"></i></div>
            <div class="auth-tile" style="left:84%;top:34%;animation-delay:1.2s"><i class="pi pi-chart-line"></i></div>
            <svg viewBox="0 0 460 320" class="w-full" role="presentation">
              <defs>
                <linearGradient id="lpScreen" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#1E3A8A" /><stop offset="1" stop-color="#0B1B4D" />
                </linearGradient>
                <linearGradient id="lpBar" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0" stop-color="#1D4ED8" /><stop offset="1" stop-color="#38BDF8" />
                </linearGradient>
                <linearGradient id="lpBase" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stop-color="#1E293B" /><stop offset="1" stop-color="#3B4A7A" />
                </linearGradient>
                <radialGradient id="lpGlow" cx=".5" cy=".5" r=".5">
                  <stop offset="0" stop-color="#3B82F6" stop-opacity=".55" /><stop offset="1" stop-color="#3B82F6" stop-opacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx="230" cy="270" rx="215" ry="42" fill="url(#lpGlow)" />
              <ellipse cx="230" cy="270" rx="190" ry="30" fill="none" stroke="#38BDF8" stroke-opacity=".8" stroke-width="3" />
              <ellipse cx="230" cy="270" rx="150" ry="22" fill="none" stroke="#6D5BFF" stroke-opacity=".6" stroke-width="2" />
              <g transform="translate(40 8)">
                <polygon points="70,20 330,50 322,215 92,232" fill="#0F172A" stroke="#6D7BFF" stroke-width="3" stroke-linejoin="round" />
                <polygon points="80,30 320,58 313,205 100,221" fill="url(#lpScreen)" />
                <rect x="96" y="52" width="38" height="36" rx="7" fill="#6D7BFF" fill-opacity=".4" />
                <rect x="98" y="100" width="38" height="36" rx="7" fill="#6D7BFF" fill-opacity=".4" />
                <rect x="100" y="148" width="38" height="36" rx="7" fill="#6D7BFF" fill-opacity=".4" />
                <polygon points="180,160 202,162 202,190 178,190" fill="url(#lpBar)" />
                <polygon points="214,146 236,148 236,192 212,192" fill="url(#lpBar)" />
                <polygon points="248,128 270,130 270,194 246,194" fill="url(#lpBar)" />
                <polygon points="282,104 304,106 304,196 280,196" fill="url(#lpBar)" />
                <polyline points="172,146 206,118 232,130 268,96 300,72" fill="none" stroke="#BAE6FD" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
                <polygon points="52,236 342,248 380,268 30,268" fill="url(#lpBase)" stroke="#6D7BFF" stroke-opacity=".7" stroke-width="2" stroke-linejoin="round" />
              </g>
            </svg>
          </div>
        </aside>

        <div class="auth-glass mx-auto w-full max-w-md rounded-3xl p-5 sm:p-8">
          <div class="mb-5 flex items-center gap-2 text-lg font-semibold text-text">
            <img src="/brand-logo.svg" alt="" aria-hidden="true" class="brand-logo" />
            <span>Laptop <span class="auth-erp">ERP</span></span>
          </div>
          <h1 class="text-3xl font-semibold text-text sm:text-4xl">{{ heading() }}</h1>
          @if (subtitle()) {
            <p class="mt-2 break-words text-sm text-muted sm:text-base">{{ subtitle() }}</p>
          }
          <div class="mt-5 sm:mt-6"><ng-content /></div>
        </div>
      </div>
    </div>
  `,
})
export class AuthCardComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input<string>('');
  readonly theme = inject(ThemeService);
}