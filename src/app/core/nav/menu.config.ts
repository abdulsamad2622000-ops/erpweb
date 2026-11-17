export interface MenuItem {
  key: string;            // translation key suffix + route id
  path: string;           // full route path
  icon: string;           // primeicons class
  permission: string;     // module.resource.action (Step 2 mein enforce hoga)
  children?: MenuItem[];
  flag?: 'website';       // feature flag (module on/off)
}

export const MENU: MenuItem[] = [
  { key: 'dashboard', path: 'dashboard', icon: 'pi pi-home', permission: 'dashboard.view.view' },
  {
    key: 'inventory', path: 'inventory', icon: 'pi pi-box', permission: 'inventory.stock.view',
    children: [
      { key: 'stock', path: 'inventory/stock', icon: 'pi pi-list', permission: 'inventory.stock.view' },
      { key: 'serials', path: 'inventory/serials', icon: 'pi pi-hashtag', permission: 'inventory.serial.view' },
      { key: 'locations', path: 'inventory/locations', icon: 'pi pi-map-marker', permission: 'inventory.location.view' },
      { key: 'ledger', path: 'inventory/ledger', icon: 'pi pi-book', permission: 'inventory.ledger.view' },
      { key: 'transfers', path: 'inventory/transfers', icon: 'pi pi-arrow-right-arrow-left', permission: 'inventory.transfer.view' },
      { key: 'counts', path: 'inventory/counts', icon: 'pi pi-check-square', permission: 'inventory.count.view' },
      { key: 'adjustments', path: 'inventory/adjustments', icon: 'pi pi-sliders-h', permission: 'inventory.adjustment.view' },
      { key: 'reservations', path: 'inventory/reservations', icon: 'pi pi-lock', permission: 'inventory.reservation.view' },
    ],
  },
  {
    key: 'products', path: 'products', icon: 'pi pi-desktop', permission: 'products.product.view',
    children: [
      { key: 'productList', path: 'products/list', icon: 'pi pi-list', permission: 'products.product.view' },
      { key: 'brands', path: 'products/brands', icon: 'pi pi-tag', permission: 'products.brand.view' },
      { key: 'categories', path: 'products/categories', icon: 'pi pi-sitemap', permission: 'products.category.view' },
      { key: 'barcodes', path: 'products/barcodes', icon: 'pi pi-qrcode', permission: 'barcode.label.view' },
    ],
  },
  {
    key: 'purchase', path: 'purchase', icon: 'pi pi-shopping-bag', permission: 'purchase.order.view',
    children: [
      { key: 'suppliers', path: 'purchase/suppliers', icon: 'pi pi-truck', permission: 'purchase.supplier.view' },
      { key: 'orders', path: 'purchase/orders', icon: 'pi pi-file', permission: 'purchase.order.view' },
      { key: 'grn', path: 'purchase/grn', icon: 'pi pi-inbox', permission: 'purchase.grn.view' },
      { key: 'purchaseReturns', path: 'purchase/returns', icon: 'pi pi-undo', permission: 'purchase.return.view' },
      { key: 'supplierPayments', path: 'purchase/payments', icon: 'pi pi-wallet', permission: 'purchase.payment.view' },
    ],
  },
  {
    key: 'sales', path: 'sales', icon: 'pi pi-shopping-cart', permission: 'sales.invoice.view',
    children: [
      { key: 'quotations', path: 'sales/quotations', icon: 'pi pi-file-edit', permission: 'sales.quotation.view' },
      { key: 'salesOrders', path: 'sales/orders', icon: 'pi pi-file', permission: 'sales.order.view' },
      { key: 'invoices', path: 'sales/invoices', icon: 'pi pi-receipt', permission: 'sales.invoice.view' },
      { key: 'challans', path: 'sales/challans', icon: 'pi pi-truck', permission: 'sales.challan.view' },
      { key: 'pos', path: 'sales/pos', icon: 'pi pi-calculator', permission: 'pos.sale.create' },
      { key: 'salesReturns', path: 'sales/returns', icon: 'pi pi-undo', permission: 'sales.return.view' },
    ],
  },
  { key: 'customers', path: 'customers', icon: 'pi pi-users', permission: 'customers.customer.view' },
  { key: 'warranty', path: 'warranty', icon: 'pi pi-shield', permission: 'warranty.claim.view' },
  { key: 'reports', path: 'reports', icon: 'pi pi-chart-bar', permission: 'reports.report.view' },
  { key: 'email', path: 'email', icon: 'pi pi-envelope', permission: 'email.template.view' },
  { key: 'website', path: 'website', icon: 'pi pi-globe', permission: 'web.order.view', flag: 'website' },
  { key: 'usersRoles', path: 'users-roles', icon: 'pi pi-user-edit', permission: 'users.user.view' },
  { key: 'settings', path: 'settings', icon: 'pi pi-cog', permission: 'settings.manage' },
];

/** Sirf leaf items (jin ke liye route banega) */
export function flattenMenu(items: MenuItem[] = MENU): MenuItem[] {
  return items.flatMap((i) => (i.children ? flattenMenu(i.children) : [i]));
}