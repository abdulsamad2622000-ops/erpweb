<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        $karachi = Branch::firstOrCreate(['name' => 'Karachi Main']);
        $lahore = Branch::firstOrCreate(['name' => 'Lahore']);

        $this->user('super@demo.test', 'Demo Super Admin', 'super_admin', 'super_admin', true,
            [$karachi, $lahore], null);

        $this->user('admin@demo.test', 'Demo Admin', 'admin', 'admin', true,
            [$karachi, $lahore],
            ['discount_percent' => 5, 'adjustment_units' => 10, 'max_sale_without_approval' => 500000]);

        $this->user('keeper@demo.test', 'Demo Store Keeper', 'store_keeper', 'staff', false,
            [$karachi],
            ['discount_percent' => 2, 'adjustment_units' => 3, 'max_sale_without_approval' => 100000]);
    }

    private function user(string $email, string $name, string $role, string $type, bool $twoFactor,
        array $branches, ?array $limits): void
    {
        // Demo password sab ka: password
        $user = User::updateOrCreate(['email' => $email], [
            'name' => $name, 'password' => 'password', 'role' => $role, 'type' => $type,
            'two_factor_enabled' => $twoFactor, 'is_active' => true,
        ] + ($limits ?? ['discount_percent' => null, 'adjustment_units' => null, 'max_sale_without_approval' => null]));

        $user->branches()->sync(collect($branches)->pluck('id'));
        $user->permissions()->delete(); // purane demo overrides saaf
    }
}