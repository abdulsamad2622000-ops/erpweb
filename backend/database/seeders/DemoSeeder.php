<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $all = config('permission_keys', []);
        $karachi = Branch::firstOrCreate(['name' => 'Karachi Main']);
        $lahore = Branch::firstOrCreate(['name' => 'Lahore']);

        $this->user('super@demo.test', 'Demo Super Admin', 'super_admin', 'super_admin', true,
            $all, [$karachi, $lahore], null);

        $this->user('admin@demo.test', 'Demo Admin', 'admin', 'admin', true,
            array_values(array_diff($all, ['settings.manage'])), [$karachi, $lahore],
            ['discount_percent' => 5, 'adjustment_units' => 10, 'max_sale_without_approval' => 500000]);

        $this->user('keeper@demo.test', 'Demo Store Keeper', 'store_keeper', 'staff', false, [
            'dashboard.view.view', 'inventory.stock.view', 'inventory.serial.view',
            'inventory.location.view', 'inventory.transfer.view', 'inventory.count.view',
        ], [$karachi],
            ['discount_percent' => 2, 'adjustment_units' => 3, 'max_sale_without_approval' => 100000]);
    }

    private function user(string $email, string $name, string $role, string $type, bool $twoFactor,
        array $keys, array $branches, ?array $limits): void
    {
        // Demo password sab ka: password
        $user = User::updateOrCreate(['email' => $email], [
            'name' => $name, 'password' => 'password', 'role' => $role, 'type' => $type,
            'two_factor_enabled' => $twoFactor, 'is_active' => true,
        ] + ($limits ?? ['discount_percent' => null, 'adjustment_units' => null, 'max_sale_without_approval' => null]));

        $user->branches()->sync(collect($branches)->pluck('id'));
        $user->permissions()->delete();
        foreach ($keys as $key) {
            $user->permissions()->create(['permission_key' => $key]);
        }
    }
}