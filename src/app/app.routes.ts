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
        path: 'purchase/payments',
        canActivate: [permissionGuard],
        data: { title: 'supplierPayments', permission: 'purchase.payment.view' },
        loadComponent: () =>
          import('./features/purchase/pages/supplier-payments.page').then((m) => m.SupplierPaymentsPage),
      },
      {
        path: 'purchase/suppliers/:id/ledger',
        canActivate: [permissionGuard],
        data: { title: 'suppliers', permission: 'purchase.supplier.view' },
        loadComponent: () =>
          import('./features/purchase/pages/supplier-ledger.page').then((m) => m.SupplierLedgerPage),
      },
      {
        path: 'purchase/suppliers',
        canActivate: [permissionGuard],
        data: { title: 'suppliers', permission: 'purchase.supplier.view' },
        loadComponent: () =>
          import('./features/purchase/pages/suppliers.page').then((m) => m.SuppliersPage),
      },
      {
        path: 'purchase/orders',
        canActivate: [permissionGuard],
        data: { title: 'orders', permission: 'purchase.order.view' },
        loadComponent: () =>
          import('./features/purchase/pages/purchase-orders.page').then((m) => m.PurchaseOrdersPage),
      },
      {
        path: 'purchase/orders/new',
        canActivate: [permissionGuard],
        data: { title: 'orders', permission: 'purchase.order.create' },
        loadComponent: () =>
          import('./features/purchase/pages/purchase-order.page').then((m) => m.PurchaseOrderPage),
      },
      {
        path: 'inventory/transfers/new',
        canActivate: [permissionGuard],
        data: { title: 'transfers', permission: 'inventory.transfer.create' },
        loadComponent: () =>
          import('./features/inventory/pages/transfer.page').then((m) => m.TransferPage),
      },
      {
        path: 'inventory/transfers/:id',
        canActivate: [permissionGuard],
        data: { title: 'transfers', permission: 'inventory.transfer.view' },
        loadComponent: () =>
          import('./features/inventory/pages/transfer.page').then((m) => m.TransferPage),
      },
      {
        path: 'inventory/transfers',
        canActivate: [permissionGuard],
        data: { title: 'transfers', permission: 'inventory.transfer.view' },
        loadComponent: () =>
          import('./features/inventory/pages/transfers.page').then((m) => m.TransfersPage),
      },
      {
        path: 'inventory/ledger',
        canActivate: [permissionGuard],
        data: { title: 'ledger', permission: 'inventory.ledger.view' },
        loadComponent: () =>
          import('./features/inventory/pages/ledger.page').then((m) => m.LedgerPage),
      },
      {
        path: 'inventory/stock',
        canActivate: [permissionGuard],
        data: { title: 'stock', permission: 'inventory.stock.view' },
        loadComponent: () =>
          import('./features/inventory/pages/stock.page').then((m) => m.StockPage),
      },
      {
        path: 'inventory/serials/:serial',
        canActivate: [permissionGuard],
        data: { title: 'serials', permission: 'inventory.serial.view' },
        loadComponent: () =>
          import('./features/inventory/pages/serial-detail.page').then((m) => m.SerialDetailPage),
      },
      {
        path: 'inventory/serials',
        canActivate: [permissionGuard],
        data: { title: 'serials', permission: 'inventory.serial.view' },
        loadComponent: () =>
          import('./features/inventory/pages/serials.page').then((m) => m.SerialsPage),
      },
      {
        path: 'purchase/returns',
        canActivate: [permissionGuard],
        data: { title: 'purchaseReturns', permission: 'purchase.return.view' },
        loadComponent: () =>
          import('./features/purchase/pages/purchase-returns.page').then((m) => m.PurchaseReturnsPage),
      },
      {
        path: 'purchase/orders/:id/matching',
        canActivate: [permissionGuard],
        data: { title: 'orders', permission: 'purchase.order.view' },
        loadComponent: () =>
          import('./features/purchase/pages/po-matching.page').then((m) => m.PoMatchingPage),
      },
      {
        path: 'purchase/grn/:id/landed-cost',
        canActivate: [permissionGuard],
        data: { title: 'grn', permission: 'purchase.grn.view' },
        loadComponent: () =>
          import('./features/purchase/pages/grn-landed-cost.page').then((m) => m.GrnLandedCostPage),
      },
      {
        path: 'purchase/orders/:id',
        canActivate: [permissionGuard],
        data: { title: 'orders', permission: 'purchase.order.view' },
        loadComponent: () =>
          import('./features/purchase/pages/purchase-order.page').then((m) => m.PurchaseOrderPage),
      },
      {
        path: 'purchase/grn',
        canActivate: [permissionGuard],
        data: { title: 'grn', permission: 'purchase.grn.view' },
        loadComponent: () =>
          import('./features/purchase/pages/grns.page').then((m) => m.GrnsPage),
      },
      {
        path: 'purchase/grn/:id',
        canActivate: [permissionGuard],
        data: { title: 'grn', permission: 'purchase.grn.view' },
        loadComponent: () =>
          import('./features/purchase/pages/grn-receive.page').then((m) => m.GrnReceivePage),
      },
      {
        path: 'products/barcodes',
        canActivate: [permissionGuard],
        data: { title: 'barcodes', permission: 'barcode.label.view' },
        loadComponent: () =>
          import('./features/labels/pages/labels.page').then((m) => m.LabelsPage),
      },
      {
        path: 'products/barcodes/templates',
        canActivate: [permissionGuard],
        data: { title: 'barcodes', permission: 'barcode.label.create' },
        loadComponent: () =>
          import('./features/labels/pages/label-templates.page').then((m) => m.LabelTemplatesPage),
      },
      {
        path: 'products/list/import',
        canActivate: [permissionGuard],
        data: { title: 'productList', permission: 'products.product.create' },
        loadComponent: () =>
          import('./features/products/pages/product-import.page').then((m) => m.ProductImportPage),
      },
      {
        path: 'products/list/new',
        canActivate: [permissionGuard],
        data: { title: 'productList', permission: 'products.product.create' },
        loadComponent: () =>
          import('./features/products/pages/product-form.page').then((m) => m.ProductFormPage),
      },
      {
        path: 'products/list/:id/edit',
        canActivate: [permissionGuard],
        data: { title: 'productList', permission: 'products.product.edit' },
        loadComponent: () =>
          import('./features/products/pages/product-form.page').then((m) => m.ProductFormPage),
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
      {
        path: 'users-roles/users/:id/permissions',
        canActivate: [permissionGuard],
        data: { title: 'users', permission: 'users.user.edit' },
        loadComponent: () =>
          import('./features/users/pages/user-permissions.page').then((m) => m.UserPermissionsPage),
      },
      {
        path: 'users-roles/audit',
        canActivate: [permissionGuard],
        data: { title: 'audit', permission: 'users.audit.view' },
        loadComponent: () =>
          import('./features/users/pages/audit.page').then((m) => m.AuditPage),
      },
      { path: 'settings', pathMatch: 'full', redirectTo: 'settings/company' },
      {
        path: 'settings/locations',
        canActivate: [permissionGuard],
        data: { title: 'locationTree', permission: 'settings.manage' },
        loadComponent: () =>
          import('./features/settings/pages/locations.page').then((m) => m.LocationsPage),
      },
      {
        path: 'settings/branches',
        canActivate: [permissionGuard],
        data: { title: 'branches', permission: 'settings.manage' },
        loadComponent: () =>
          import('./features/settings/pages/branches.page').then((m) => m.BranchesPage),
      },
      {
        path: 'settings/warehouses',
        canActivate: [permissionGuard],
        data: { title: 'warehouses', permission: 'settings.manage' },
        loadComponent: () =>
          import('./features/settings/pages/warehouses.page').then((m) => m.WarehousesPage),
      },
      {
        path: 'settings/company',
        canActivate: [permissionGuard],
        data: { title: 'companyProfile', permission: 'settings.manage' },
        loadComponent: () =>
          import('./features/settings/pages/company.page').then((m) => m.CompanyPage),
      },
      {
        path: 'settings/number-series',
        canActivate: [permissionGuard],
        data: { title: 'numberSeries', permission: 'settings.manage' },
        loadComponent: () =>
          import('./features/settings/pages/number-series.page').then((m) => m.NumberSeriesPage),
      },
      {
        path: 'settings/price-tiers',
        canActivate: [permissionGuard],
        data: { title: 'priceTiers', permission: 'settings.manage' },
        loadComponent: () =>
          import('./features/settings/pages/price-tiers.page').then((m) => m.PriceTiersPage),
      },
      {
        path: 'settings/costing',
        canActivate: [permissionGuard],
        data: { title: 'costing', permission: 'settings.manage' },
        loadComponent: () =>
          import('./features/settings/pages/costing.page').then((m) => m.CostingPage),
      },
      {
        path: 'settings/backup',
        canActivate: [permissionGuard],
        data: { title: 'backup', permission: 'settings.manage' },
        loadComponent: () =>
          import('./features/settings/pages/backup.page').then((m) => m.BackupPage),
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
