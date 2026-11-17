import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/auth/guards';
import { FEATURE_FLAGS } from './core/config/feature-flags';
import { flattenMenu } from './core/nav/menu.config';

const placeholderRoutes: Routes = flattenMenu()
  .filter((i) => i.flag !== 'website' || FEATURE_FLAGS.website)
  .map((i) => ({
    path: i.path,
    canActivate: [permissionGuard],
    data: { title: i.key, permission: i.permission },
    loadComponent: () =>
      import('./features/placeholder/placeholder.page').then((m) => m.PlaceholderPage),
  }));

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'recover-email',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/recover-email.page').then((m) => m.RecoverEmailPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
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
    ],
  },
];