import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto mt-24 max-w-md text-center">
      <p class="text-6xl font-bold text-danger">403</p>
      <h1 class="mt-3 text-2xl font-semibold text-text">Access denied</h1>
      <p class="mt-2 text-muted">You do not have permission to open this page.</p>
      <a routerLink="/dashboard" class="mt-6 inline-flex h-12 items-center rounded-[10px] bg-accent px-6 text-white">Back to dashboard</a>
    </div>
  `,
})
export class ForbiddenPage {}