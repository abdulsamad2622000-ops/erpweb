<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCatalogTest extends TestCase
{
    use RefreshDatabase;

    private User $super;
    private User $admin;
    private User $cashier;
    private User $keeper;

    protected function setUp(): void
    {
        parent::setUp();
        config(['permission_keys' => [
            'dashboard.view.view', 'inventory.stock.view', 'settings.manage',
            'products.product.view', 'products.product.create', 'products.product.edit',
            'products.product.delete', 'products.cost.view',
        ]]);
        $this->seed(RoleSeeder::class);

        $this->super = $this->make('super_admin', 'super_admin', 's@t.test');
        $this->admin = $this->make('admin', 'admin', 'a@t.test');
        $this->cashier = $this->make('staff', 'cashier', 'c@t.test');
        $this->keeper = $this->make('staff', 'store_keeper', 'k@t.test');
    }

    private function make(string $type, string $role, string $email): User
    {
        return User::create([
            'name' => $email, 'email' => $email, 'password' => 'password',
            'type' => $type, 'role' => $role, 'is_active' => true,
        ]);
    }

    private function payload(array $extra = []): array
    {
        return $extra + [
            'name' => 'Latitude 5440',
            'brand_id' => Brand::firstOrCreate(['name' => 'Dell'])->id,
            'tracking_type' => 'serialized',
            'warranty_months' => 12,
            'specs' => ['cpu' => 'i5', 'ram' => '16GB'],
            'variants' => [[
                'sku' => 'LAT-5440-16-512', 'name' => '16GB/512GB', 'cost_price' => 90000,
                'prices' => [
                    ['tier' => 'retail', 'price' => 120000, 'minPrice' => 110000],
                    ['tier' => 'wholesale', 'price' => 110000],
                ],
            ]],
        ];
    }

    private function createProduct(array $extra = []): array
    {
        return $this->postJson('/api/v1/products', $this->payload($extra))->assertCreated()->json('data');
    }

    private function row(array $o = []): array
    {
        return $o + [
            'product_name' => 'ThinkPad T14', 'brand' => 'Lenovo', 'category' => null,
            'tracking_type' => 'serialized', 'sku' => 'TP-T14-1', 'variant_name' => '8GB',
            'retail_price' => 100000, 'wholesale_price' => 95000, 'cost_price' => 80000, 'warranty_months' => 12,
        ];
    }

    public function test_access_rules(): void
    {
        $this->getJson('/api/v1/products')->assertStatus(401);

        $this->actingAs($this->keeper, 'sanctum')->getJson('/api/v1/products')->assertStatus(403);

        $this->actingAs($this->cashier, 'sanctum')->getJson('/api/v1/products')->assertOk();
        $this->postJson('/api/v1/products', $this->payload())->assertStatus(403);
        $this->postJson('/api/v1/brands', ['name' => 'X'])->assertStatus(403);
    }

    public function test_brands_crud_and_delete_rules(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $id = $this->postJson('/api/v1/brands', ['name' => 'HP'])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/brands', ['name' => 'HP'])->assertStatus(422);
        $this->putJson("/api/v1/brands/{$id}", ['name' => 'HP Inc'])->assertOk()->assertJsonPath('data.name', 'HP Inc');

        $this->createProduct(['brand_id' => $id]);
        $this->deleteJson("/api/v1/brands/{$id}")->assertStatus(422);
        $row = collect($this->getJson('/api/v1/brands')->assertOk()->json('data'))->firstWhere('id', $id);
        $this->assertSame(1, $row['productsCount']);
    }

    public function test_category_tree_and_rules(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $laptops = $this->postJson('/api/v1/categories', ['name' => 'Laptops'])->assertCreated()->json('data.id');
        $gaming = $this->postJson('/api/v1/categories', ['name' => 'Gaming', 'parent_id' => $laptops])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/categories', ['name' => 'Gaming', 'parent_id' => $laptops])->assertStatus(422);

        $tree = $this->getJson('/api/v1/categories')->assertOk();
        $this->assertSame('Laptops', $tree->json('data.0.name'));
        $this->assertSame('Gaming', $tree->json('data.0.children.0.name'));

        // category apne neeche nahi ja sakti
        $this->putJson("/api/v1/categories/{$laptops}", ['parent_id' => $gaming])->assertStatus(422);

        $this->deleteJson("/api/v1/categories/{$laptops}")->assertStatus(422);
        $this->deleteJson("/api/v1/categories/{$gaming}")->assertNoContent();
        $this->deleteJson("/api/v1/categories/{$laptops}")->assertNoContent();
    }

    public function test_product_is_created_with_variants_and_prices(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $p = $this->createProduct();
        $this->assertSame('serialized', $p['trackingType']);
        $this->assertSame('LAT-5440-16-512', $p['variants'][0]['sku']);
        $this->assertCount(2, $p['variants'][0]['prices']);
        $this->assertEquals(90000, $p['variants'][0]['costPrice']);

        $this->getJson("/api/v1/products/{$p['id']}")->assertOk()->assertJsonPath('data.brand.name', 'Dell');

        // SKU dobara nahi chalta
        $this->postJson('/api/v1/products', $this->payload(['name' => 'Other']))->assertStatus(422);
    }

    public function test_only_serialized_and_batch_tracking_types_are_allowed(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        foreach (['bundle', 'kit', 'service', 'quantity'] as $bad) {
            $this->postJson('/api/v1/products', $this->payload(['tracking_type' => $bad]))
                ->assertStatus(422)->assertJsonValidationErrors(['tracking_type']);
        }

        $batch = $this->payload(['name' => 'Batch Item', 'tracking_type' => 'batch']);
        $batch['variants'][0]['sku'] = 'B-1';
        $this->postJson('/api/v1/products', $batch)->assertCreated()->assertJsonPath('data.trackingType', 'batch');
    }

    public function test_minimum_price_cannot_be_above_the_price(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $bad = $this->payload();
        $bad['variants'][0]['prices'] = [['tier' => 'retail', 'price' => 120000, 'minPrice' => 130000]];

        $this->postJson('/api/v1/products', $bad)->assertStatus(422);
        $this->assertSame(0, Product::count());
    }

    public function test_cost_price_needs_the_cost_permission(): void
    {
        $this->actingAs($this->super, 'sanctum');
        $p = $this->createProduct();
        $this->getJson("/api/v1/products/{$p['id']}")->assertOk();
        $this->assertEquals(90000, $this->getJson("/api/v1/products/{$p['id']}")->json('data.variants.0.costPrice'));

        // cashier ko cost nahi dikhta
        $this->actingAs($this->cashier, 'sanctum')->getJson("/api/v1/products/{$p['id']}")
            ->assertOk()->assertJsonMissingPath('data.variants.0.costPrice');

        // admin par deny ho to wo cost dekh bhi nahi sakta aur likh bhi nahi sakta
        $this->admin->permissions()->create(['permission_key' => 'products.cost.view', 'effect' => 'deny']);
        $this->actingAs($this->admin, 'sanctum');

        $second = $this->payload(['name' => 'Second']);
        $second['variants'][0]['sku'] = 'SEC-1';
        $created = $this->postJson('/api/v1/products', $second)->assertCreated()
            ->assertJsonMissingPath('data.variants.0.costPrice')->json('data');

        $this->assertNull(ProductVariant::find($created['variants'][0]['id'])->cost_price);
    }

    public function test_price_changes_are_recorded_in_history(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $p = $this->createProduct();
        $variantId = $p['variants'][0]['id'];

        // wahi values dobara: koi nayi history nahi
        $this->putJson("/api/v1/variants/{$variantId}/prices", ['prices' => [
            ['tier' => 'retail', 'price' => 120000, 'minPrice' => 110000],
        ]])->assertOk();
        $this->assertCount(2, $this->getJson("/api/v1/variants/{$variantId}/price-history")->json('data'));

        $this->putJson("/api/v1/variants/{$variantId}/prices", ['prices' => [
            ['tier' => 'retail', 'price' => 125000, 'minPrice' => 115000],
        ]])->assertOk();

        $history = $this->getJson("/api/v1/variants/{$variantId}/price-history")->assertOk()->json('data');
        $this->assertCount(3, $history);
        $this->assertSame('retail', $history[0]['tier']);
        $this->assertEquals(120000, $history[0]['oldPrice']);
        $this->assertEquals(125000, $history[0]['newPrice']);
        $this->assertSame('a@t.test', $history[0]['changedBy']);
    }

    public function test_variants_can_be_added_updated_and_removed(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $p = $this->createProduct();

        $v2 = $this->postJson("/api/v1/products/{$p['id']}/variants", [
            'sku' => 'LAT-5440-32-1TB', 'name' => '32GB/1TB', 'barcode' => 'BC-1',
            'prices' => [['tier' => 'retail', 'price' => 160000]],
        ])->assertCreated()->json('data');

        $this->postJson("/api/v1/products/{$p['id']}/variants", ['sku' => 'LAT-X', 'barcode' => 'BC-1'])
            ->assertStatus(422);

        $this->putJson("/api/v1/variants/{$v2['id']}", ['name' => '32GB / 1TB'])
            ->assertOk()->assertJsonPath('data.name', '32GB / 1TB');

        $this->deleteJson("/api/v1/variants/{$v2['id']}")->assertNoContent();
        $this->deleteJson('/api/v1/variants/'.$p['variants'][0]['id'])->assertStatus(422);
    }

    public function test_product_update_sets_reorder_levels_but_not_tracking_type(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $p = $this->createProduct();
        $branch = Branch::create(['name' => 'Karachi Main']);

        $this->putJson("/api/v1/products/{$p['id']}", [
            'name' => 'Latitude 5440 Pro', 'warranty_months' => 24, 'tracking_type' => 'batch',
            'reorder_levels' => [['branchId' => $branch->id, 'level' => 5]],
        ])->assertOk()
            ->assertJsonPath('data.name', 'Latitude 5440 Pro')
            ->assertJsonPath('data.trackingType', 'serialized')
            ->assertJsonCount(1, 'data.reorderLevels');
    }

    public function test_product_list_filters_search_and_paging(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $this->createProduct();
        $other = $this->payload(['name' => 'Lenovo Batch', 'tracking_type' => 'batch', 'brand_id' => Brand::create(['name' => 'Lenovo'])->id]);
        $other['variants'][0]['sku'] = 'LEN-1';
        $this->postJson('/api/v1/products', $other)->assertCreated();

        $this->assertCount(1, $this->getJson('/api/v1/products?tracking_type=batch')->json('data'));
        $this->assertCount(1, $this->getJson('/api/v1/products?search=LAT-5440')->json('data'));

        $page = $this->getJson('/api/v1/products?per_page=1')->assertOk();
        $this->assertSame(2, $page->json('meta.total'));
        $this->assertSame(2, $page->json('meta.lastPage'));
    }

    public function test_import_preview_reports_row_errors(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $res = $this->postJson('/api/v1/products/import/validate', ['rows' => [
            $this->row(),
            $this->row(['sku' => 'TP-T14-2', 'tracking_type' => 'kit']),
            $this->row(['sku' => 'TP-T14-1']),
        ]])->assertOk();

        $this->assertSame(['total' => 3, 'valid' => 1, 'invalid' => 2], $res->json('summary'));
        $this->assertSame('create_product', $res->json('rows.0.action'));
        $this->assertArrayHasKey('tracking_type', $res->json('rows.1.errors'));
        $this->assertArrayHasKey('sku', $res->json('rows.2.errors'));
        $this->assertSame(0, Product::count());
    }

    public function test_import_commit_is_all_or_nothing(): void
    {
        $this->actingAs($this->admin, 'sanctum');

        $this->postJson('/api/v1/products/import', ['rows' => [
            $this->row(), $this->row(['sku' => 'TP-T14-2', 'tracking_type' => 'kit']),
        ]])->assertStatus(422)->assertJsonPath('summary.invalid', 1);
        $this->assertSame(0, Product::count());
        $this->assertSame(0, Brand::count());

        $this->postJson('/api/v1/products/import', ['rows' => [
            $this->row(), $this->row(['sku' => 'TP-T14-2', 'variant_name' => '16GB']),
        ]])->assertCreated()->assertJsonPath('created.products', 1)->assertJsonPath('created.variants', 2);

        $this->assertSame(1, Product::count());
        $this->assertSame(2, ProductVariant::count());
        $this->assertSame(1, Brand::where('name', 'Lenovo')->count());
    }

    public function test_product_delete_needs_the_delete_permission(): void
    {
        $this->actingAs($this->admin, 'sanctum');
        $p = $this->createProduct();

        $this->actingAs($this->cashier, 'sanctum')->deleteJson("/api/v1/products/{$p['id']}")->assertStatus(403);

        $this->actingAs($this->admin, 'sanctum')->deleteJson("/api/v1/products/{$p['id']}")->assertNoContent();
        $this->assertSame(0, ProductVariant::count());
    }
}