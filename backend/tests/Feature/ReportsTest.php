<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Step 15: sales/profit grouping, stock value, repairs, dashboard money gate. */
class ReportsTest extends TestCase
{
    use RefreshDatabase;

    public function test_reports_and_dashboard(): void
    {
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password', 'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $this->actingAs($boss, 'sanctum')->withHeader('X-Client', 'erp-web');
        $b = DB::table('branches')->insertGetId(['name' => 'K', 'created_at' => now(), 'updated_at' => now()]);
        $wh = DB::table('warehouses')->insertGetId(['branch_id' => $b, 'code' => 'M', 'name' => 'Main', 'type' => 'main', 'created_at' => now(), 'updated_at' => now()]);
        $brand = DB::table('brands')->insertGetId(['name' => 'HP', 'created_at' => now(), 'updated_at' => now()]);
        $p = $this->postJson('/api/v1/products', ['sku' => 'LAP-R1', 'name' => 'HP R1', 'barcode' => null, 'brandId' => $brand, 'categoryId' => null,
            'trackBatch' => false, 'specs' => ['cpu' => 'i5', 'ram' => '8 GB', 'storage' => '256 GB'], 'warrantyMonths' => 0, 'costPrice' => 70000, 'minPrice' => null,
            'prices' => [['tier' => 'retail', 'price' => 100000]], 'reorderLevels' => [], 'variants' => [], 'images' => [], 'isActive' => true])->json('id');
        foreach (['R1', 'R2', 'R3'] as $i => $s) {
            DB::table('stock_serials')->insert(['serial' => $s, 'product_id' => $p, 'warehouse_id' => $wh, 'status' => $i < 2 ? 'sold' : 'in_stock',
                'unit_cost' => 80000, 'created_at' => now()->subDays(10), 'updated_at' => now()]);
        }
        // 2 laptops, bill discount 10000 -> revenue 190000, cost 160000
        $sid = DB::table('sales')->insertGetId(['number' => 'INV-1', 'channel' => 'pos', 'warehouse_id' => $wh, 'subtotal' => 200000, 'discount' => 10000,
            'total' => 190000, 'paid' => 190000, 'change_due' => 0, 'created_by' => $boss->id, 'created_at' => now(), 'updated_at' => now()]);
        foreach (['R1', 'R2'] as $s) {
            DB::table('sale_lines')->insert(['sale_id' => $sid, 'product_id' => $p, 'serial' => $s, 'qty' => 1, 'unit_price' => 100000, 'warranty_months' => 0]);
        }

        $this->getJson('/api/v1/reports/sales?groupBy=product')->assertOk()->assertJsonPath('rows.0.label', 'HP R1')
            ->assertJsonPath('totals.revenue', 190000)->assertJsonPath('totals.cost', 160000)->assertJsonPath('totals.profit', 30000)
            ->assertJsonPath('totals.bills', 1);
        $this->getJson('/api/v1/reports/sales?groupBy=staff')->assertJsonPath('rows.0.label', 'Boss');
        $this->getJson('/api/v1/reports/stock')->assertOk()->assertJsonPath('totals.units', 1)->assertJsonPath('totals.value', 80000)
            ->assertJsonPath('rows.0.oldestDays', 10)->assertJsonPath('byStatus.sold', 2);
        $this->getJson('/api/v1/reports/purchases')->assertOk()->assertJsonPath('totals.billed', 0);
        $this->getJson('/api/v1/reports/repairs')->assertOk()->assertJsonPath('delivered', 0);

        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('todaySales', 190000)->assertJsonPath('monthProfit', 30000)
            ->assertJsonPath('stockValue', 80000)->assertJsonPath('canSeeMoney', true)->assertJsonCount(14, 'last14');

        $cashier = User::create(['name' => 'C', 'email' => 'c@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'cashier', 'is_active' => true]);
        $this->actingAs($cashier, 'sanctum');
        $this->getJson('/api/v1/dashboard')->assertOk()->assertJsonPath('canSeeMoney', false)->assertJsonMissingPath('monthProfit');
        $this->getJson('/api/v1/reports/sales')->assertForbidden();
    }
}
