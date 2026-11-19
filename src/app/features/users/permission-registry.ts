import { UserType } from '../../core/auth/auth.models';

export interface PermissionItem {
  action: string;
  key: string;
}
export interface PermissionRow {
  label: string;
  prefix: string;
  perms: PermissionItem[];
}
export interface PermissionModule {
  key: string;
  label: string;
  rows: PermissionRow[];
}

const row = (label: string, prefix: string, actions: string[]): PermissionRow => ({
  label,
  prefix,
  perms: actions.map((action) => ({ action, key: `${prefix}.${action}` })),
});
const CRUD = ['view', 'create', 'edit', 'delete'];

/** Frontend ka permission registry. Asli list backend ke registry API se aayegi. */
export const PERMISSION_MODULES: PermissionModule[] = [
  { key: 'dashboard', label: 'Dashboard', rows: [row('Dashboard', 'dashboard.view', ['view'])] },
  {
    key: 'inventory',
    label: 'Inventory',
    rows: [
      row('Stock', 'inventory.stock', ['view']),
      row('Serials', 'inventory.serial', ['view']),
      row('Locations', 'inventory.location', ['view']),
      row('Stock ledger', 'inventory.ledger', ['view']),
      row('Transfers', 'inventory.transfer', ['view', 'create', 'approve']),
      row('Stock counts', 'inventory.count', ['view', 'create', 'approve']),
      row('Adjustments', 'inventory.adjustment', ['view', 'create', 'approve']),
      row('Reservations', 'inventory.reservation', ['view', 'create']),
    ],
  },
  {
    key: 'products',
    label: 'Products',
    rows: [
      row('Products', 'products.product', CRUD),
      row('Cost price', 'products.cost', ['view']),
      row('Brands', 'products.brand', CRUD),
      row('Categories', 'products.category', CRUD),
      row('Barcodes & labels', 'barcode.label', ['view', 'create', 'print']),
    ],
  },
  {
    key: 'purchase',
    label: 'Purchase',
    rows: [
      row('Suppliers', 'purchase.supplier', ['view', 'create', 'edit']),
      row('Purchase orders', 'purchase.order', ['view', 'create', 'edit', 'approve']),
      row('Receive stock (GRN)', 'purchase.grn', ['view', 'create']),
      row('Purchase returns', 'purchase.return', ['view', 'create']),
      row('Supplier payments', 'purchase.payment', ['view', 'create']),
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    rows: [
      row('Quotations', 'sales.quotation', ['view', 'create', 'edit']),
      row('Sales orders', 'sales.order', ['view', 'create', 'edit']),
      row('Invoices', 'sales.invoice', ['view', 'create', 'edit']),
      row('Delivery challans', 'sales.challan', ['view', 'create']),
      row('Sales returns', 'sales.return', ['view', 'create']),
      row('Retail POS', 'pos.sale', ['create']),
    ],
  },
  { key: 'customers', label: 'Customers', rows: [row('Customers', 'customers.customer', ['view', 'create', 'edit'])] },
  { key: 'warranty', label: 'Warranty', rows: [row('Warranty claims', 'warranty.claim', ['view', 'create', 'edit'])] },
  { key: 'reports', label: 'Reports', rows: [row('Reports', 'reports.report', ['view'])] },
  { key: 'email', label: 'Email', rows: [row('Email templates', 'email.template', ['view', 'edit'])] },
  {
    key: 'users',
    label: 'Users & roles',
    rows: [row('Users', 'users.user', CRUD), row('Roles', 'users.role', CRUD), row('Audit log', 'users.audit', ['view'])],
  },
  { key: 'settings', label: 'Settings', rows: [row('Settings', 'settings', ['manage'])] },
];

export function moduleKeys(m: PermissionModule): string[] {
  return m.rows.flatMap((r) => r.perms.map((p) => p.key));
}

export function allPermissionKeys(): string[] {
  return PERMISSION_MODULES.flatMap(moduleKeys);
}

/**
 * Kaun si permissions dene ki ijazat hai. SuperAdmin sab de sakta hai,
 * baaqi sirf wohi jo unke paas khud hain.
 */
export function grantableKeys(actor: UserType | null | undefined, held: ReadonlySet<string>): Set<string> {
  const all = allPermissionKeys();
  return new Set(actor === 'super_admin' ? all : all.filter((k) => held.has(k)));
}

export interface RoleTemplate {
  name: string;
  description: string;
  permissions: string[];
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: 'Store Keeper',
    description: 'Stock, transfers and counts.',
    permissions: [
      'dashboard.view.view', 'inventory.stock.view', 'inventory.serial.view', 'inventory.location.view',
      'inventory.ledger.view', 'inventory.transfer.view', 'inventory.transfer.create',
      'inventory.count.view', 'inventory.count.create', 'products.product.view',
      'barcode.label.view', 'barcode.label.print',
    ],
  },
  {
    name: 'Sales Executive',
    description: 'Quotations, orders, invoices and POS.',
    permissions: [
      'dashboard.view.view', 'products.product.view', 'inventory.stock.view', 'inventory.serial.view',
      'customers.customer.view', 'customers.customer.create', 'sales.quotation.view',
      'sales.quotation.create', 'sales.quotation.edit', 'sales.order.view', 'sales.order.create',
      'sales.invoice.view', 'sales.invoice.create', 'pos.sale.create', 'sales.return.view',
      'sales.return.create',
    ],
  },
  {
    name: 'Accountant',
    description: 'Payments, receivables and reports.',
    permissions: [
      'dashboard.view.view', 'purchase.payment.view', 'purchase.payment.create',
      'customers.customer.view', 'sales.invoice.view', 'reports.report.view', 'products.cost.view',
    ],
  },
  {
    name: 'Branch Manager',
    description: 'Everything except users, roles and settings.',
    permissions: allPermissionKeys().filter((k) => k !== 'settings.manage' && !k.startsWith('users.')),
  },
];
