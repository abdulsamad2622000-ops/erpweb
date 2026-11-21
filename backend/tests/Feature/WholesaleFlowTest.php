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

/** Step 11: quotation -> order -> challan (serials) -> invoice (credit limit) -> payment -> credit return. */
class WholesaleFlowTest extends TestCase
{
    use RefreshDatabase;

    private int $wh;

    private int $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password',
            'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $this->actingAs($boss, 'sanctum')->withHeader('X-Client', 'erp-web');
        $this->wh = Warehouse::create(['branch_id' => Branch::create(['name' => 'Karachi'])->id, 'code' => 'MAIN', 'name' => 'Main', 'type' => 'main'])->id;
        $this->product = $this->postJson('/api/v1/products', [
            'sku' => 'LAP-DELL-001', 'name' => 'Dell Latitude 5440', 'barcode' => null, 'brandId' => Brand::create(['name' => 'Dell'])->id,
            'categoryId' => null, 'trackBatch' => false, 'specs' => ['cpu' => 'i5', 'ram' => '8 GB', 'storage' => '256 GB'],
            'warrantyMonths' => 3, 'costPrice' => 80000, 'minPrice' => null,
            'prices' => [['tier' => 'retail', 'price' => 100000], ['tier' => 'wholesale', 'price' => 90000]],
            'reorderLevels' => [], 'variants' => [], 'images' => [], 'isActive' => true,
        ])->assertCreated()->json('id');
        foreach (['W0001', 'W0002', 'W0003'] as $s) {
            StockSerial::create(['serial' => $s, 'product_id' => $this->product, 'warehouse_id' => $this->wh, 'status' => 'in_stock', 'unit_cost' => 80000]);
        }
    }

    public function test_full_wholesale_flow(): void
    {
        $cust = $this->postJson('/api/v1/customers', ['name' => 'Ali Traders', 'phone' => '0321-0000001', 'type' => 'wholesale',
            'creditLimit' => 200000, 'paymentTermsDays' => 30, 'city' => 'Karachi'])->assertCreated()->assertJsonPath('priceTier', 'wholesale')->json('id');

        $staff = User::create(['name' => 'Sana', 'email' => 's@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'sales_staff',
            'is_active' => true, 'discount_percent' => 1]);
        $this->actingAs($staff, 'sanctum');
        $this->getJson("/api/v1/sales/price?customerId={$cust}&productId={$this->product}")->assertOk()
            ->assertJsonPath('tierPrice', 90000)->assertJsonPath('lowestPrice', 89100);
        $this->postJson('/api/v1/sales/quotations', ['customerId' => $cust, 'lines' => [['productId' => $this->product, 'qty' => 3, 'unitPrice' => 85000]]])
            ->assertStatus(422);
        $q = $this->postJson('/api/v1/sales/quotations', ['customerId' => $cust, 'validUntil' => now()->addWeek()->toDateString(),
            'lines' => [['productId' => $this->product, 'qty' => 3]]])->assertCreated()->assertJsonPath('total', 270000)->json('id');
        $this->postJson("/api/v1/sales/quotations/{$q}/send")->assertOk()->assertJsonPath('status', 'sent');
        $this->putJson("/api/v1/sales/quotations/{$q}", ['customerId' => $cust, 'lines' => [['productId' => $this->product, 'qty' => 1]]])->assertStatus(409);
        $order = $this->postJson("/api/v1/sales/quotations/{$q}/convert")->assertOk()->assertJsonPath('quotation.status', 'accepted')->json('order');
        $this->postJson("/api/v1/sales/quotations/{$q}/convert")->assertStatus(409);
        $lineId = $order['lines'][0]['id'];

        // Challan: 2 serials
        $this->postJson('/api/v1/sales/challans', ['orderId' => $order['id'], 'warehouseId' => $this->wh,
            'lines' => [['orderLineId' => $lineId, 'serials' => ['NOPE']]]])->assertStatus(422);
        $ch = $this->postJson('/api/v1/sales/challans', ['orderId' => $order['id'], 'warehouseId' => $this->wh,
            'lines' => [['orderLineId' => $lineId, 'serials' => ['w0001', 'W0002']]]])->assertCreated()->json();
        $this->assertSame('sold', StockSerial::where('serial', 'W0001')->value('status'));
        $this->getJson("/api/v1/sales/orders/{$order['id']}")->assertJsonPath('status', 'partial')->assertJsonPath('lines.0.deliveredQty', 2);
        $this->postJson("/api/v1/sales/orders/{$order['id']}/cancel")->assertStatus(409);

        // Invoice 180000 on credit (limit 200000)
        $staff2 = User::create(['name' => 'Acc', 'email' => 'a@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'accountant', 'is_active' => true]);
        $this->actingAs($staff2, 'sanctum');
        $inv = $this->postJson('/api/v1/sales/invoices', ['challanId' => $ch['id']])->assertCreated()
            ->assertJsonPath('total', 180000)->assertJsonPath('balance', 180000)->assertJsonPath('status', 'unpaid')
            ->assertJsonPath('lines.0.warrantyMonths', 3)->json();
        $this->assertSame(now()->addDays(30)->toDateString(), $inv['dueDate']);
        $this->postJson('/api/v1/sales/invoices', ['challanId' => $ch['id']])->assertStatus(409);
        $this->getJson("/api/v1/customers/{$cust}")->assertJsonPath('balance', 180000);

        // Third serial: would go over credit (180000 + 90000 > 200000)
        $this->actingAs($staff, 'sanctum');
        $ch2 = $this->postJson('/api/v1/sales/challans', ['orderId' => $order['id'], 'warehouseId' => $this->wh,
            'lines' => [['orderLineId' => $lineId, 'serials' => ['W0003']]]])->assertCreated()->json('id');
        $this->getJson("/api/v1/sales/orders/{$order['id']}")->assertJsonPath('status', 'delivered');
        $this->actingAs($staff2, 'sanctum');
        $this->postJson('/api/v1/sales/invoices', ['challanId' => $ch2])->assertStatus(422)->assertJsonValidationErrors('payments');

        // Payment, then credit available
        $this->postJson("/api/v1/sales/invoices/{$inv['id']}/payments", ['method' => 'transfer', 'amount' => 200000])->assertStatus(422);
        $this->postJson("/api/v1/sales/invoices/{$inv['id']}/payments", ['method' => 'transfer', 'amount' => 100000, 'reference' => 'TRX-1'],
            ['Idempotency-Key' => 'pay-1'])->assertOk()->assertJsonPath('balance', 80000)->assertJsonPath('status', 'partial');
        $this->postJson("/api/v1/sales/invoices/{$inv['id']}/payments", ['method' => 'transfer', 'amount' => 100000, 'reference' => 'TRX-1'],
            ['Idempotency-Key' => 'pay-1'])->assertOk()->assertJsonPath('balance', 80000);
        $this->postJson('/api/v1/sales/invoices', ['challanId' => $ch2, 'payments' => [['method' => 'cash', 'amount' => 10000]]])
            ->assertCreated()->assertJsonPath('balance', 80000);
        $this->getJson("/api/v1/customers/{$cust}")->assertJsonPath('balance', 160000);

        // Credit return reduces balance
        $this->actingAs(User::where('email', 'boss@t.test')->first(), 'sanctum');
        $line = $inv['lines'][1]['id'];
        $this->postJson('/api/v1/pos/returns', ['saleId' => $inv['id'], 'lines' => [['saleLineId' => $line]], 'refundMethod' => 'credit',
            'reason' => 'Dead on arrival, credited'])->assertCreated()->assertJsonPath('amount', 90000);
        $this->getJson("/api/v1/sales/invoices/{$inv['id']}")->assertJsonPath('status', 'paid')->assertJsonPath('balance', 0);
        $this->getJson("/api/v1/customers/{$cust}")->assertJsonPath('balance', 70000);
        $this->getJson('/api/v1/sales/invoices?channel=wholesale&unpaid=true')->assertJsonPath('total', 1);
    }

    public function test_cash_customer_cannot_take_credit(): void
    {
        $cust = $this->postJson('/api/v1/customers', ['name' => 'Walk', 'phone' => '03000000009', 'type' => 'dealer'])->json('id');
        $o = $this->postJson('/api/v1/sales/orders', ['customerId' => $cust, 'lines' => [['productId' => $this->product, 'qty' => 1]]])
            ->assertCreated()->assertJsonPath('total', 100000)->json(); // dealer tier missing -> retail
        $ch = $this->postJson('/api/v1/sales/challans', ['orderId' => $o['id'], 'warehouseId' => $this->wh,
            'lines' => [['orderLineId' => $o['lines'][0]['id'], 'serials' => ['W0001']]]])->json('id');
        $this->postJson('/api/v1/sales/invoices', ['challanId' => $ch])->assertStatus(422);
        $this->postJson('/api/v1/sales/invoices', ['challanId' => $ch, 'payments' => [['method' => 'cash', 'amount' => 100000]]])
            ->assertCreated()->assertJsonPath('status', 'paid');
    }
}
