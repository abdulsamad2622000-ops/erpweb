import { Routes } from '@angular/router';
import { flattenMenu } from './core/nav/menu.config';
import { FEATURE_FLAGS } from './core/config/feature-flags';

const placeholderRoutes: Routes = flattenMenu()
  .filter((i) => i.flag !== 'website' || FEATURE_FLAGS.website)
  .map((i) => ({
    path: i.path,
    data: { title: i.key, permission: i.permission },
    loadComponent: () =>
      import('./features/placeholder/placeholder.page').then((m) => m.PlaceholderPage),
  }));

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ...placeholderRoutes,
  {
    path: '403',
    loadComponent: () => import('./features/errors/forbidden.page').then((m) => m.ForbiddenPage),
  },
  {
    path: '404',
    loadComponent: () => import('./features/errors/not-found.page').then((m) => m.NotFoundPage),
  },
  { path: '**', redirectTo: '404' },
];