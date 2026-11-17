import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto mt-24 max-w-md text-center">
      <p class="text-6xl font-bold text-accent">404</p>
      <h1 class="mt-3 text-2xl font-semibold text-text">Page not found</h1>
      <p class="mt-2 text-muted">The page you are looking for does not exist.</p>
      <a routerLink="/dashboard" class="mt-6 inline-flex h-12 items-center rounded-[10px] bg-accent px-6 text-white">Back to dashboard</a>
    </div>
  `,
})
export class NotFoundPage {}