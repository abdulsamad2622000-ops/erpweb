<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\User;
use App\Services\NumberSeriesService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsStructureTest extends TestCase
{
    use RefreshDatabase;

    private User $super;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        config(['permission_keys' => [
            'dashboard.view.view', 'inventory.stock.view', 'settings.manage', 'products.product.view',
        ]]);
        $this->seed(RoleSeeder::class);

        $this->super = $this->make('super_admin', 'super_admin', 's@t.test');
        $this->admin = $this->make('admin', 'admin', 'a@t.test');
    }

    private function make(string $type, string $role, string $email): User
    {
        return User::create([
            'name' => $email, 'email' => $email, 'password' => 'password',
            'type' => $type, 'role' => $role, 'is_active' => true,
        ]);
    }

    private function asSuper(): static
    {
        return $this->actingAs($this->super, 'sanctum');
    }

    private function warehouse(string $code = 'MS'): array
    {
        $branch = Branch::firstOrCreate(['name' => 'Karachi Main']);

        return $this->postJson('/api/v1/warehouses', [
            'branch_id' => $branch->id, 'name' => "Store $code", 'code' => $code, 'type' => 'sellable',
        ])->assertCreated()->json('data');
    }

    private function location(int $warehouseId, string $code, ?int $parentId = null)
    {
        return $this->postJson("/api/v1/warehouses/{$warehouseId}/locations", [
            'parent_id' => $parentId, 'name' => "Loc $code", 'code' => $code,
        ]);
    }

    public function test_settings_screens_need_the_settings_manage_permission(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $this->getJson('/api/v1/settings/company')->assertStatus(403);
        $this->getJson('/api/v1/number-series')->assertStatus(403);
        $this->postJson('/api/v1/branches', ['name' => 'X'])->assertStatus(403);

        $this->asSuper()->getJson('/api/v1/settings/company')->assertOk();
    }

    public function test_company_settings_are_saved_and_validated(): void
    {
        $this->asSuper();

        $this->getJson('/api/v1/settings/company')->assertOk()->assertJsonPath('data.currency', 'PKR');

        $this->putJson('/api/v1/settings/company', ['name' => 'Novastack Traders', 'currency' => 'usd'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Novastack Traders')
            ->assertJsonPath('data.currency', 'USD');

        $this->getJson('/api/v1/settings/company')->assertJsonPath('data.name', 'Novastack Traders');
        $this->putJson('/api/v1/settings/company', ['currency' => 'PAKISTAN'])->assertStatus(422);
        $this->getJson('/api/v1/settings/unknown')->assertStatus(404);
    }

    public function test_costing_and_negative_stock_settings(): void
    {
        $this->asSuper();

        $this->getJson('/api/v1/settings/inventory')
            ->assertJsonPath('data.costingMethod', 'weighted_average')
            ->assertJsonPath('data.negativeStock', 'block');

        $this->putJson('/api/v1/settings/inventory', ['costingMethod' => 'fifo', 'negativeStock' => 'allow_with_approval'])
            ->assertOk()->assertJsonPath('data.costingMethod', 'fifo');

        $this->putJson('/api/v1/settings/inventory', ['costingMethod' => 'random'])->assertStatus(422);
    }

    public function test_number_series_generate_sequential_numbers(): void
    {
        $svc = app(NumberSeriesService::class);

        $this->assertSame('PO-00001', $svc->next('po'));
        $this->assertSame('PO-00002', $svc->next('po'));
        $this->assertSame('GRN-00001', $svc->next('grn'));
    }

    public function test_number_series_can_be_configured_but_not_moved_backwards(): void
    {
        $svc = app(NumberSeriesService::class);
        $svc->next('po');
        $svc->next('po');

        $this->asSuper();
        $this->putJson('/api/v1/number-series/po', ['next_number' => 1])->assertStatus(422);
        $this->putJson('/api/v1/number-series/po', ['next_number' => 10])->assertOk()
            ->assertJsonPath('data.preview', 'PO-00010');

        $this->putJson('/api/v1/number-series/grn', ['prefix' => 'GR/', 'include_year' => true])->assertOk();
        $this->assertSame('GR/'.now()->format('Y').'-00001', $svc->next('grn'));

        $this->getJson('/api/v1/number-series')->assertOk()->assertJsonCount(6, 'data');
        $this->putJson('/api/v1/number-series/nope', ['prefix' => 'X'])->assertStatus(404);
    }

    public function test_branches_crud_and_admin_can_only_read(): void
    {
        $this->asSuper();
        $this->postJson('/api/v1/branches', ['name' => 'Karachi Main', 'code' => 'KHI'])
            ->assertCreated()->assertJsonPath('data.code', 'KHI')->assertJsonPath('data.isActive', true);
        $this->postJson('/api/v1/branches', ['name' => 'Karachi Main'])->assertStatus(422);
        $this->postJson('/api/v1/branches', ['name' => 'Another', 'code' => 'KHI'])->assertStatus(422);

        $id = Branch::where('name', 'Karachi Main')->value('id');
        $this->putJson("/api/v1/branches/{$id}", ['phone' => '021-111', 'is_active' => false])
            ->assertOk()->assertJsonPath('data.phone', '021-111')->assertJsonPath('data.isActive', false);

        $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/branches')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_branch_with_warehouses_cannot_be_deleted(): void
    {
        $this->asSuper();
        $w = $this->warehouse();

        $this->deleteJson("/api/v1/branches/{$w['branchId']}")->assertStatus(422);

        $this->deleteJson("/api/v1/warehouses/{$w['id']}")->assertNoContent();
        $this->deleteJson("/api/v1/branches/{$w['branchId']}")->assertNoContent();
    }

    public function test_warehouse_types_and_unique_code_per_branch(): void
    {
        $this->asSuper();
        $w = $this->warehouse('MS');

        $this->postJson('/api/v1/warehouses', [
            'branch_id' => $w['branchId'], 'name' => 'Junk', 'code' => 'JK', 'type' => 'junk',
        ])->assertStatus(422);

        $this->postJson('/api/v1/warehouses', [
            'branch_id' => $w['branchId'], 'name' => 'Dup', 'code' => 'MS', 'type' => 'repair',
        ])->assertStatus(422);

        $res = $this->getJson('/api/v1/warehouses?type=sellable')->assertOk();
        $this->assertCount(1, $res->json('data'));
        $this->assertContains('in_transit', $res->json('types'));

        $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/warehouses')->assertOk();
    }

    public function test_location_hierarchy_zone_rack_shelf_bin_with_bin_barcode(): void
    {
        $this->asSuper();
        $w = $this->warehouse('MS');

        $zone = $this->location($w['id'], 'A')->assertCreated()->assertJsonPath('data.level', 'zone');
        $rack = $this->location($w['id'], 'R1', $zone->json('data.id'))->assertCreated()->assertJsonPath('data.level', 'rack');
        $shelf = $this->location($w['id'], 'S1', $rack->json('data.id'))->assertCreated()->assertJsonPath('data.level', 'shelf');
        $bin = $this->location($w['id'], 'B1', $shelf->json('data.id'))
            ->assertCreated()
            ->assertJsonPath('data.level', 'bin')
            ->assertJsonPath('data.path', 'MS/A/R1/S1/B1');

        $this->assertMatchesRegularExpression('/^BIN-\d{6}$/', $bin->json('data.barcode'));
        $this->assertNull($zone->json('data.barcode'));

        // bin ke andar kuch nahi ban sakta
        $this->location($w['id'], 'X', $bin->json('data.id'))->assertStatus(422);
    }

    public function test_location_tree_lookup_and_delete_rules(): void
    {
        $this->asSuper();
        $w = $this->warehouse('MS');

        $zone = $this->location($w['id'], 'A')->json('data');
        $rack = $this->location($w['id'], 'R1', $zone['id'])->json('data');
        $shelf = $this->location($w['id'], 'S1', $rack['id'])->json('data');
        $bin = $this->location($w['id'], 'B1', $shelf['id'])->json('data');

        $tree = $this->getJson("/api/v1/warehouses/{$w['id']}/locations")->assertOk();
        $this->assertSame('A', $tree->json('data.0.code'));
        $this->assertSame('B1', $tree->json('data.0.children.0.children.0.children.0.code'));

        $this->getJson('/api/v1/locations/lookup?barcode='.$bin['barcode'])
            ->assertOk()->assertJsonPath('data.path', 'MS/A/R1/S1/B1');
        $this->getJson('/api/v1/locations/lookup?barcode=BIN-999999')->assertStatus(404);

        $this->deleteJson("/api/v1/locations/{$zone['id']}")->assertStatus(422);
        $this->deleteJson("/api/v1/warehouses/{$w['id']}")->assertStatus(422);

        $this->deleteJson("/api/v1/locations/{$bin['id']}")->assertNoContent();
    }

    public function test_location_validation_rules(): void
    {
        $this->asSuper();
        $w1 = $this->warehouse('W1');
        $w2 = $this->warehouse('W2');

        $zone = $this->location($w1['id'], 'A')->json('data');

        // same level par code dobara nahi
        $this->location($w1['id'], 'A')->assertStatus(422);

        // doosre warehouse ka parent nahi chalta
        $this->location($w2['id'], 'R1', $zone['id'])->assertStatus(422);

        // rename aur deactivate
        $this->putJson("/api/v1/locations/{$zone['id']}", ['name' => 'Zone Alpha', 'is_active' => false])
            ->assertOk()->assertJsonPath('data.name', 'Zone Alpha')->assertJsonPath('data.isActive', false);
    }

    public function test_price_tiers_defaults_and_rules(): void
    {
        $this->asSuper();

        $list = $this->getJson('/api/v1/price-tiers')->assertOk();
        $this->assertSame(['retail', 'wholesale', 'dealer'], array_column($list->json('data'), 'key'));
        $this->assertTrue($list->json('data.0.isDefault'));

        $vip = $this->postJson('/api/v1/price-tiers', ['name' => 'VIP', 'is_default' => true])
            ->assertCreated()->assertJsonPath('data.key', 'vip')->assertJsonPath('data.isDefault', true);

        $after = $this->getJson('/api/v1/price-tiers')->json('data');
        $this->assertCount(1, array_filter($after, fn ($t) => $t['isDefault']));

        $retailId = collect($after)->firstWhere('key', 'retail')['id'];
        $this->deleteJson("/api/v1/price-tiers/{$retailId}")->assertStatus(422);
        $this->deleteJson('/api/v1/price-tiers/'.$vip->json('data.id'))->assertStatus(422);

        $extra = $this->postJson('/api/v1/price-tiers', ['name' => 'Staff Price'])->assertCreated();
        $this->deleteJson('/api/v1/price-tiers/'.$extra->json('data.id'))->assertNoContent();

        $this->actingAs($this->admin, 'sanctum')->getJson('/api/v1/price-tiers')->assertOk();
    }

    public function test_settings_changes_are_audited(): void
    {
        $this->asSuper();
        $this->putJson('/api/v1/settings/company', ['name' => 'Novastack'])->assertOk();

        $this->getJson('/api/v1/audit-log')->assertOk()->assertJsonPath('data.0.action', 'settings.updated');
    }
}