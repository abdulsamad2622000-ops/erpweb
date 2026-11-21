<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $all = config('permission_keys', []);

        $presets = [
            'super_admin' => ['Super Admin', $all],
            'admin' => ['Admin', array_values(array_diff($all, ['settings.manage']))],
            'store_keeper' => ['Store Keeper', [
                'dashboard.view.view', 'inventory.stock.view', 'inventory.serial.view', 'inventory.ledger.view',
                'inventory.location.view', 'inventory.transfer.view', 'inventory.transfer.create', 'inventory.count.view',
                'purchase.grn.view', 'purchase.grn.create', 'barcode.label.view', 'barcode.label.print',
            ]],
            'purchase_staff' => ['Purchase Staff', [
                'dashboard.view.view', 'products.product.view', 'inventory.stock.view',
                'purchase.supplier.view', 'purchase.supplier.create', 'purchase.supplier.edit',
                'purchase.order.view', 'purchase.order.create', 'purchase.order.edit',
                'purchase.grn.view', 'purchase.grn.create', 'purchase.return.view', 'purchase.return.create',
                'purchase.payment.view', 'barcode.label.view', 'barcode.label.print',
            ]],
            'sales_staff' => ['Sales Staff', [
                'dashboard.view.view', 'products.product.view', 'inventory.stock.view',
                'customers.customer.view', 'warranty.claim.view',
                'sales.quotation.view', 'sales.order.view', 'sales.invoice.view',
                'sales.challan.view', 'sales.return.view',
            ]],
            'cashier' => ['Cashier', [
                'dashboard.view.view', 'pos.sale.create', 'products.product.view',
                'customers.customer.view', 'sales.invoice.view',
            ]],
            'accountant' => ['Accountant', [
                'dashboard.view.view', 'reports.report.view', 'purchase.payment.view', 'purchase.payment.create',
                'purchase.supplier.view', 'purchase.order.view',
                'sales.invoice.view', 'customers.customer.view',
            ]],
        ];

        foreach ($presets as $key => [$name, $keys]) {
            $role = Role::updateOrCreate(['key' => $key], ['name' => $name, 'is_system' => true]);
            $role->permissions()->delete();
            // Sirf wohi keys jo registry mein hain (config badalne par bhi seeder na toote)
            foreach (array_values(array_unique(array_intersect($keys, $all))) as $permissionKey) {
                $role->permissions()->create(['permission_key' => $permissionKey]);
            }
        }
    }
}