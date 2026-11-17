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
                'dashboard.view.view', 'inventory.stock.view', 'inventory.serial.view',
                'inventory.location.view', 'inventory.transfer.view', 'inventory.count.view',
            ]],
            'purchase_staff' => ['Purchase Staff', [
                'dashboard.view.view', 'products.product.view', 'inventory.stock.view',
                'purchase.supplier.view', 'purchase.order.view', 'purchase.grn.view',
                'purchase.return.view', 'purchase.payment.view',
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
                'dashboard.view.view', 'reports.report.view', 'purchase.payment.view',
                'sales.invoice.view', 'customers.customer.view',
            ]],
        ];

        foreach ($presets as $key => [$name, $keys]) {
            $role = Role::updateOrCreate(['key' => $key], ['name' => $name, 'is_system' => true]);
            $role->permissions()->delete();
            foreach (array_values(array_unique($keys)) as $permissionKey) {
                $role->permissions()->create(['permission_key' => $permissionKey]);
            }
        }
    }
}