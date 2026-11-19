import { isDevMode } from '@angular/core';
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

// Sirf ng serve mein. Production build mein ye route register nahi hota.
const devRoutes: Routes = [
  {
    path: 'dev/components',
    loadComponent: () =>
      import('./features/dev/components-showcase.page').then((m) => m.ComponentsShowcasePage),
  },
];

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
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage),
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
      {
        path: 'products/brands',
        canActivate: [permissionGuard],
        data: { title: 'brands', permission: 'products.brand.view' },
        loadComponent: () =>
          import('./features/products/pages/brands.page').then((m) => m.BrandsPage),
      },
      {
        path: 'products/categories',
        canActivate: [permissionGuard],
        data: { title: 'categories', permission: 'products.category.view' },
        loadComponent: () =>
          import('./features/products/pages/categories.page').then((m) => m.CategoriesPage),
      },
      {
        path: 'products/list',
        canActivate: [permissionGuard],
        data: { title: 'productList', permission: 'products.product.view' },
        loadComponent: () =>
          import('./features/products/pages/products.page').then((m) => m.ProductsPage),
      },
      {
        path: 'users-roles/users',
        canActivate: [permissionGuard],
        data: { title: 'users', permission: 'users.user.view' },
        loadComponent: () =>
          import('./features/users/pages/users.page').then((m) => m.UsersPage),
      },
      {
        path: 'users-roles/roles',
        canActivate: [permissionGuard],
        data: { title: 'roles', permission: 'users.role.view' },
        loadComponent: () =>
          import('./features/users/pages/roles.page').then((m) => m.RolesPage),
      },
      {
        path: 'users-roles/roles/new',
        canActivate: [permissionGuard],
        data: { title: 'roles', permission: 'users.role.create' },
        loadComponent: () =>
          import('./features/users/pages/role-form.page').then((m) => m.RoleFormPage),
      },
      {
        path: 'users-roles/roles/:id',
        canActivate: [permissionGuard],
        data: { title: 'roles', permission: 'users.role.view' },
        loadComponent: () =>
          import('./features/users/pages/role-form.page').then((m) => m.RoleFormPage),
      },
      ...(isDevMode() ? devRoutes : []),
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
