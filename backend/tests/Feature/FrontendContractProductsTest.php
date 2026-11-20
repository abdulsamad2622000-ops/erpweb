<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Brand;
use App\Models\Category;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FrontendContractProductsTest extends TestCase
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
        $this->withHeader('X-Client', 'erp-web');
    }

    private function body(array $o = []): array
    {
        return $o + [
            'sku' => 'LAP-DELL-001', 'name' => 'Dell Latitude 5440', 'barcode' => '8901000000011',
            'brandId' => Brand::firstOrCreate(['name' => 'Dell'])->id, 'categoryId' => Category::firstOrCreate(['name' => 'Laptops'])->id,
            'trackBatch' => false,
            'specs' => ['cpu' => 'i5', 'ram' => '16 GB', 'storage' => '512 GB', 'gpu' => '', 'screen' => '14"'],
            'warrantyMonths' => 12, 'costPrice' => 142000, 'minPrice' => 150000,
            'prices' => [['tier' => 'retail', 'price' => 165000], ['tier' => 'wholesale', 'price' => 155000]],
            'reorderLevels' => [['branchId' => Branch::firstOrCreate(['name' => 'Karachi'])->id, 'level' => 5]],
            'variants' => [['sku' => 'LAP-DELL-001-16', 'name' => '16 GB', 'barcode' => null, 'isActive' => true]],
            'images' => [['url' => 'data:image/png;base64,iVBORw0KGgo=', 'name' => 'front.png', 'isPrimary' => true]],
            'isActive' => true,
        ];
    }

    public function test_product_round_trip_in_frontend_shape(): void
    {
        $p = $this->postJson('/api/v1/products', $this->body())->assertCreated()->json();

        $this->assertSame('LAP-DELL-001', $p['sku']);
        $this->assertSame('8901000000011', $p['barcode']);
        $this->assertFalse($p['trackBatch']);
        $this->assertEquals(142000, $p['costPrice']);
        $this->assertEquals(150000, $p['minPrice']);
        $this->assertCount(2, $p['prices']);
        $this->assertSame('LAP-DELL-001-16', $p['variants'][0]['sku']);
        $this->assertSame('front.png', $p['images'][0]['name']);

        $list = $this->getJson('/api/v1/products?page=1&pageSize=10&search=dell')->assertOk();
        $list->assertJsonPath('total', 1)->assertJsonPath('data.0.sku', 'LAP-DELL-001');

        // Update: price badli (history), naya variant, purana hata
        $upd = $this->body([
            'prices' => [['tier' => 'retail', 'price' => 170000], ['tier' => 'wholesale', 'price' => 155000]],
            'variants' => [['sku' => 'LAP-DELL-001-32', 'name' => '32 GB', 'barcode' => null, 'isActive' => true]],
        ]);
        $this->putJson("/api/v1/products/{$p['id']}", $upd)->assertOk()
            ->assertJsonPath('variants.0.sku', 'LAP-DELL-001-32')
            ->assertJsonCount(1, 'variants');

        $history = $this->getJson("/api/v1/products/{$p['id']}/history")->assertOk()->json();
        $this->assertSame(170000.0, (float) $history[0]['newPrice']);
        $this->assertSame('retail', $history[0]['tier']);

        // Tracking type badal nahi sakta, SKU duplicate nahi
        $this->putJson("/api/v1/products/{$p['id']}", $this->body(['trackBatch' => true]))->assertStatus(422);
        $this->postJson('/api/v1/products', $this->body(['name' => 'Copy', 'barcode' => null, 'variants' => []]))->assertStatus(422);
    }

    public function test_brands_and_categories_lists(): void
    {
        $this->postJson('/api/v1/brands', ['name' => 'HP', 'isActive' => true])->assertCreated();
        $parent = $this->postJson('/api/v1/categories', ['name' => 'Laptops', 'parentId' => null, 'isActive' => true])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/categories', ['name' => 'Gaming', 'parentId' => $parent, 'isActive' => true])->assertCreated();

        $this->getJson('/api/v1/brands?page=1&pageSize=10&search=h')->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.isActive', true);
        $cats = $this->getJson('/api/v1/categories?pageSize=100')->assertOk();
        $cats->assertJsonPath('total', 2);
        $this->assertContains($parent, array_column($cats->json('data'), 'parentId'));
    }

    public function test_without_header_old_shape_still_works(): void
    {
        $this->withHeaders(['X-Client' => '']);
        $this->getJson('/api/v1/brands')->assertOk()->assertJsonMissingPath('total');
    }
}
