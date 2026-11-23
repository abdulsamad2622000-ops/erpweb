<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Brand;
use App\Models\StockSerial;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Step 12: shift -> scan -> sale (discount limit, split pay) -> hold -> return -> close shift. */
class PosFlowTest extends TestCase
{
    use RefreshDatabase;

    private int $wh;

    private int $product;

    private User $cashier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password',
            'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $this->actingAs($boss, 'sanctum')->withHeader('X-Client', 'erp-web');
        $b = Branch::create(['name' => 'Karachi']);
        $this->wh = Warehouse::create(['branch_id' => $b->id, 'code' => 'SHOW', 'name' => 'Showroom', 'type' => 'showroom'])->id;
        $this->product = $this->postJson('/api/v1/products', [
            'sku' => 'LAP-HP-001', 'name' => 'HP EliteBook 840', 'barcode' => null, 'brandId' => Brand::create(['name' => 'HP'])->id,
            'categoryId' => null, 'trackBatch' => false, 'specs' => ['cpu' => 'i7', 'ram' => '16 GB', 'storage' => '512 GB'],
            'warrantyMonths' => 6, 'costPrice' => 90000, 'minPrice' => null, 'prices' => [['tier' => 'retail', 'price' => 100000]],
            'reorderLevels' => [], 'variants' => [], 'images' => [], 'isActive' => true,
        ])->assertCreated()->json('id');
        foreach (['SN0001', 'SN0002', 'SN0003'] as $s) {
            StockSerial::create(['serial' => $s, 'product_id' => $this->product, 'warehouse_id' => $this->wh, 'status' => 'in_stock', 'unit_cost' => 90000]);
        }
        $this->cashier = User::create(['name' => 'Ali', 'email' => 'ali@t.test', 'password' => 'password', 'type' => 'staff',
            'role' => 'cashier', 'is_active' => true, 'discount_percent' => 5]);
    }

    public function test_full_pos_flow(): void
    {
        $this->actingAs($this->cashier, 'sanctum');
        $this->getJson('/api/v1/pos/shift')->assertOk()->assertJsonPath('shift', null)->assertJsonPath('discountLimit', 5);
        $this->getJson('/api/v1/pos/scan/SN0001')->assertStatus(409);
        $this->postJson('/api/v1/pos/shift/open', ['warehouseId' => $this->wh, 'openingCash' => 5000])->assertCreated();
        $this->postJson('/api/v1/pos/shift/open', ['warehouseId' => $this->wh, 'openingCash' => 5000])->assertStatus(409);

        $this->getJson('/api/v1/pos/scan/sn0001')->assertOk()->assertJsonPath('serial', 'SN0001')->assertJsonPath('price', 100000)
            ->assertJsonPath('warrantyMonths', 6);
        $this->getJson('/api/v1/pos/scan/LAP-HP-001')->assertStatus(422);
        $this->getJson('/api/v1/pos/scan/NOPE')->assertStatus(404);
        $this->getJson('/api/v1/pos/search?search=elite')->assertOk()->assertJsonPath('0.inStock', 3);

        $line = fn (string $s) => ['productId' => $this->product, 'serial' => $s];
        // 5% of 200000 = 10000 max
        $this->postJson('/api/v1/pos/sales', ['lines' => [$line('SN0001'), $line('SN0002')], 'discount' => 10001,
            'payments' => [['method' => 'cash', 'amount' => 200000]]])->assertStatus(422)->assertJsonValidationErrors('discount');
        $this->postJson('/api/v1/pos/sales', ['lines' => [$line('SN0001'), $line('SN0001')],
            'payments' => [['method' => 'cash', 'amount' => 200000]]])->assertStatus(422);
        $this->postJson('/api/v1/pos/sales', ['lines' => [$line('SN0001')], 'payments' => [['method' => 'card', 'amount' => 110000]]])
            ->assertStatus(422)->assertJsonValidationErrors('payments');

        $sale = $this->postJson('/api/v1/pos/sales', ['lines' => [$line('SN0001'), $line('SN0002')], 'discount' => 10000,
            'payments' => [['method' => 'card', 'amount' => 100000], ['method' => 'cash', 'amount' => 95000]]])
            ->assertCreated()->assertJsonPath('total', 190000)->assertJsonPath('change', 5000)
            ->assertJsonPath('lines.0.warrantyMonths', 6)->json();
        $this->assertSame('sold', StockSerial::where('serial', 'SN0001')->value('status'));
        $this->getJson('/api/v1/pos/scan/SN0001')->assertStatus(422);
        $this->getJson('/api/v1/pos/search?search=elite')->assertJsonPath('0.inStock', 1);

        // Hold / recall
        $h = $this->postJson('/api/v1/pos/holds', ['label' => 'Bill 1', 'payload' => ['lines' => [['serial' => 'SN0003']]]])->assertCreated()->json('id');
        $this->getJson('/api/v1/pos/holds')->assertJsonPath('0.payload.lines.0.serial', 'SN0003');
        $this->deleteJson("/api/v1/pos/holds/{$h}")->assertNoContent();

        // Quick customer
        $this->postJson('/api/v1/customers', ['name' => 'Bilal', 'phone' => '0300-1234567'])->assertCreated()->assertJsonPath('phone', '03001234567');
        $this->postJson('/api/v1/customers', ['name' => 'Other', 'phone' => '03001234567'])->assertStatus(422);

        // Return by serial
        $found = $this->getJson('/api/v1/pos/sales/find/SN0002')->assertOk()->assertJsonPath('number', $sale['number'])->json();
        $lineId = $found['lines'][1]['id'];
        $this->postJson('/api/v1/pos/returns', ['saleId' => $sale['id'], 'lines' => [['saleLineId' => $lineId]], 'refundMethod' => 'cash', 'reason' => 'short'])
            ->assertStatus(422);
        $this->postJson('/api/v1/pos/returns', ['saleId' => $sale['id'], 'lines' => [['saleLineId' => $lineId]], 'refundMethod' => 'cash',
            'reason' => 'Customer changed mind'])->assertCreated()->assertJsonPath('amount', 95000)->assertJsonPath('sale.lines.1.returnedQty', 1);
        $this->postJson('/api/v1/pos/returns', ['saleId' => $sale['id'], 'lines' => [['saleLineId' => $lineId]], 'refundMethod' => 'cash',
            'reason' => 'Customer changed mind'])->assertStatus(422);
        $this->assertSame('in_stock', StockSerial::where('serial', 'SN0002')->value('status'));

        // Close: expected = 5000 + 95000 - 5000 change - 95000 refund = 0
        $this->getJson('/api/v1/pos/shift')->assertJsonPath('shift.expectedCash', 0)->assertJsonPath('shift.salesCount', 1);
        $this->postJson('/api/v1/pos/shift/close', ['countedCash' => 100])->assertStatus(422)->assertJsonValidationErrors('note');
        $this->postJson('/api/v1/pos/shift/close', ['countedCash' => 0])->assertOk()->assertJsonPath('countedCash', 0);
        $this->getJson('/api/v1/pos/shift')->assertJsonPath('shift', null);
    }

    public function test_requires_pos_permission(): void
    {
        $u = User::create(['name' => 'Acc', 'email' => 'acc@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'accountant', 'is_active' => true]);
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/pos/shift')->assertForbidden();
    }
}
