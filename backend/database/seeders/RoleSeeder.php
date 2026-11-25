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
                'inventory.count.create', 'inventory.putaway.create', 'inventory.adjustment.view', 'inventory.adjustment.create', 'inventory.reservation.view',
                'purchase.grn.view', 'purchase.grn.create', 'barcode.label.view', 'barcode.label.print',
                'sales.order.view', 'sales.challan.view', 'sales.challan.create',
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
                'inventory.reservation.view', 'inventory.reservation.create',
                'customers.customer.view', 'customers.customer.create', 'warranty.claim.view', 'warranty.claim.create',
                'sales.quotation.view', 'sales.quotation.create', 'sales.quotation.edit',
                'sales.order.view', 'sales.order.create', 'sales.order.edit', 'sales.invoice.view',
                'sales.challan.view', 'sales.challan.create', 'sales.return.view',
            ]],
            'cashier' => ['Cashier', [
                'dashboard.view.view', 'pos.sale.create', 'products.product.view',
                'customers.customer.view', 'customers.customer.create', 'sales.invoice.view',
                'sales.return.view', 'sales.return.create', 'warranty.claim.view', 'warranty.claim.create',
            ]],
            'technician' => ['Technician', [
                'dashboard.view.view', 'products.product.view', 'inventory.serial.view',
                'warranty.claim.view', 'warranty.claim.create', 'warranty.claim.edit', 'inventory.stock.view',
            ]],
            'accountant' => ['Accountant', [
                'dashboard.view.view', 'reports.report.view', 'purchase.payment.view', 'purchase.payment.create',
                'purchase.supplier.view', 'purchase.order.view',
                'sales.invoice.view', 'sales.invoice.create', 'sales.invoice.edit', 'sales.challan.view',
                'customers.customer.view', 'customers.customer.edit',
                'accounts.expense.view', 'accounts.expense.create', 'accounts.expense.edit', 'accounts.cashbook.view', 'email.message.send',
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