<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\PriceTier;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FrontendContractSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->actingAs(User::create([
            'name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password',
            'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true,
        ]), 'sanctum');
    }

    public function test_company_round_trip(): void
    {
        $this->getJson('/api/v1/settings/company')->assertOk()->assertJsonPath('currency', 'PKR');

        $this->putJson('/api/v1/settings/company', [
            'name' => 'Star Computer', 'logo' => null, 'address' => 'Saddar', 'city' => 'Karachi', 'country' => 'Pakistan',
            'phone' => '021-1234567', 'email' => 'info@star.test', 'taxNumber' => '123', 'taxRate' => 18, 'currency' => 'pkr',
        ])->assertOk()->assertJsonPath('city', 'Karachi')->assertJsonPath('taxRate', 18)->assertJsonPath('currency', 'PKR');

        $this->putJson('/api/v1/settings/company', ['name' => '', 'taxRate' => 200, 'currency' => 'PK'])->assertStatus(422);
    }

    public function test_costing_maps_frontend_names(): void
    {
        $this->putJson('/api/v1/settings/costing', ['method' => 'serial_specific', 'negativeStock' => 'warn'])
            ->assertOk()->assertJsonPath('method', 'serial_specific')->assertJsonPath('negativeStock', 'warn');
        $this->getJson('/api/v1/settings/inventory')->assertJsonPath('data.costingMethod', 'specific_serial');
    }

    public function test_number_series_and_price_tiers(): void
    {
        $series = $this->getJson('/api/v1/settings/number-series')->assertOk()->json();
        $this->assertSame(['PO', 'GRN', 'INVOICE'], array_column($series, 'code'));
        $po = $series[0];

        $this->putJson("/api/v1/settings/number-series/{$po['id']}", ['prefix' => 'PO-', 'nextNumber' => 100, 'padding' => 4, 'resetYearly' => true])
            ->assertOk()->assertJsonPath('nextNumber', 100)->assertJsonPath('resetYearly', true);
        $this->putJson("/api/v1/settings/number-series/{$po['id']}", ['prefix' => 'PO-', 'nextNumber' => 5, 'padding' => 4, 'resetYearly' => true])
            ->assertStatus(422);

        $tiers = $this->getJson('/api/v1/settings/price-tiers')->assertOk()->json();
        $this->assertSame(['retail', 'wholesale', 'dealer'], array_column($tiers, 'code'));
        $dealer = PriceTier::where('key', 'dealer')->first();
        $this->putJson("/api/v1/settings/price-tiers/{$dealer->id}", ['name' => 'Dealers', 'isActive' => false])
            ->assertOk()->assertJsonPath('isActive', false)->assertJsonPath('name', 'Dealers');
        $retail = PriceTier::where('key', 'retail')->first();
        $this->putJson("/api/v1/settings/price-tiers/{$retail->id}", ['name' => 'Retail', 'isActive' => false])->assertStatus(422);

        $this->getJson('/api/v1/settings/backup')->assertOk()->assertJsonStructure(['status', 'lastBackupAt', 'frequency', 'time', 'retentionDays', 'location']);
    }

    public function test_branches_warehouses_locations_with_camel_case(): void
    {
        $b = $this->postJson('/api/v1/branches', ['code' => 'KHI', 'name' => 'Karachi Main', 'city' => 'Karachi', 'address' => '', 'phone' => '', 'isActive' => true])
            ->assertCreated()->assertJsonPath('data.city', 'Karachi')->json('data.id');
        $this->getJson('/api/v1/branches?page=1&pageSize=10&search=kar')->assertOk()->assertJsonPath('total', 1);

        $w = $this->postJson('/api/v1/warehouses', ['branchId' => $b, 'code' => 'SELL', 'name' => 'Sellable', 'type' => 'sellable', 'isActive' => true])
            ->assertCreated()->json('data.id');
        $this->getJson("/api/v1/warehouses?branchId={$b}&pageSize=10")->assertOk()->assertJsonPath('total', 1);

        $zone = $this->postJson('/api/v1/locations', ['warehouseId' => $w, 'parentId' => null, 'level' => 'zone', 'code' => 'A', 'name' => 'Zone A', 'isActive' => true])
            ->assertCreated()->json('data.id');
        $this->postJson('/api/v1/locations', ['warehouseId' => $w, 'parentId' => $zone, 'level' => 'rack', 'code' => 'R1', 'name' => 'Rack 1', 'isActive' => true])
            ->assertCreated();
        $this->getJson("/api/v1/locations?warehouseId={$w}&pageSize=100")->assertOk()->assertJsonPath('total', 2);
        $this->assertSame(1, Branch::count());
    }
}
