<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Brand;
use App\Models\User;
use App\Models\Warehouse;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Purchase -> GRN -> stock -> labels -> transfer -> return -> payment: poora flow frontend contract mein. */
class PurchaseInventoryFlowTest extends TestCase
{
    use RefreshDatabase;

    private int $wh1;

    private int $wh2;

    private int $product;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->actingAs(User::create([
            'name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password',
            'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true,
        ]), 'sanctum');
        $this->withHeader('X-Client', 'erp-web');

        $b = Branch::create(['name' => 'Karachi']);
        $this->wh1 = Warehouse::create(['branch_id' => $b->id, 'code' => 'MAIN', 'name' => 'Main', 'type' => 'sellable'])->id;
        $this->wh2 = Warehouse::create(['branch_id' => $b->id, 'code' => 'SHOW', 'name' => 'Showroom', 'type' => 'showroom'])->id;
        $this->product = $this->postJson('/api/v1/products', [
            'sku' => 'LAP-DELL-001', 'name' => 'Dell Latitude 5440', 'barcode' => null, 'brandId' => Brand::create(['name' => 'Dell'])->id,
            'categoryId' => null, 'trackBatch' => false, 'specs' => ['cpu' => 'i5', 'ram' => '16 GB', 'storage' => '512 GB'],
            'warrantyMonths' => 12, 'costPrice' => 140000, 'minPrice' => null, 'prices' => [['tier' => 'retail', 'price' => 165000]],
            'reorderLevels' => [], 'variants' => [], 'images' => [], 'isActive' => true,
        ])->assertCreated()->json('id');
    }

    public function test_full_purchase_to_stock_flow(): void
    {
        // Supplier
        $sup = $this->postJson('/api/v1/purchase/suppliers', ['name' => 'Sample Traders', 'phone' => '0300', 'email' => null, 'city' => 'Karachi',
            'taxNumber' => '', 'paymentTermsDays' => 30, 'isActive' => true])->assertCreated()->json('id');
        $this->postJson('/api/v1/purchase/suppliers', ['name' => 'sample traders', 'paymentTermsDays' => 0, 'isActive' => true])->assertStatus(422);
        $this->getJson('/api/v1/purchase/suppliers?pageSize=500&search=sample')->assertJsonPath('total', 1);

        // PO: draft -> submit -> approve
        $po = $this->postJson('/api/v1/purchase/orders', ['supplierId' => $sup, 'warehouseId' => $this->wh1, 'orderDate' => '2026-11-21',
            'expectedDate' => null, 'terms' => '30 days', 'lines' => [['productId' => $this->product, 'qty' => 3, 'unitCost' => 140000]]])
            ->assertCreated()->assertJsonPath('status', 'draft')->assertJsonPath('lines.0.serialized', true)->json();
        $this->postJson('/api/v1/purchase/grns', ['poId' => $po['id']])->assertStatus(409);
        $this->postJson("/api/v1/purchase/orders/{$po['id']}/approve")->assertStatus(409);
        $this->postJson("/api/v1/purchase/orders/{$po['id']}/submit")->assertOk()->assertJsonPath('status', 'pending_approval');
        $this->postJson("/api/v1/purchase/orders/{$po['id']}/approve", ['note' => 'ok'])->assertOk()->assertJsonPath('status', 'approved');

        // GRN
        $grn = $this->postJson('/api/v1/purchase/grns', ['poId' => $po['id']])->assertCreated()->json();
        $this->postJson('/api/v1/purchase/grns', ['poId' => $po['id']])->assertOk()->assertJsonPath('id', $grn['id']); // wahi draft
        $line = fn (array $serials) => ['lines' => [['productId' => $this->product, 'qty' => 0, 'serials' => $serials]]];
        $acc = fn (string $s) => ['serial' => $s, 'status' => 'accepted', 'note' => null];

        $this->postJson('/api/v1/purchase/serials/check', ['serial' => '5cg 1111 aaa', 'productId' => $this->product])->assertJsonPath('ok', true);
        $this->postJson('/api/v1/purchase/serials/check', ['serial' => 'x', 'productId' => $this->product])->assertJsonPath('reason', 'invalid_format');
        $this->postJson("/api/v1/purchase/grns/{$grn['id']}/post", $line([['serial' => 'R1R1R1', 'status' => 'rejected', 'note' => null]]))->assertStatus(422);
        $this->postJson("/api/v1/purchase/grns/{$grn['id']}/post", $line([$acc('A1A1A1'), $acc('A2A2A2'), $acc('A3A3A3'), $acc('A4A4A4')]))->assertStatus(422);
        $this->putJson("/api/v1/purchase/grns/{$grn['id']}", $line([$acc('A1A1A1')]))->assertOk()->assertJsonPath('lines.0.serials.0.serial', 'A1A1A1');

        $posted = $this->postJson("/api/v1/purchase/grns/{$grn['id']}/post", $line([
            $acc('5CG1111AAA'), $acc('5CG1111AAB'), ['serial' => '5CG1111AAC', 'status' => 'rejected', 'note' => 'Screen cracked'],
        ]))->assertOk()->assertJsonPath('status', 'posted')->json();
        $this->assertSame(0, $posted['lines'][0]['previouslyReceived']);
        $this->getJson("/api/v1/purchase/orders/{$po['id']}")->assertJsonPath('status', 'partially_received')->assertJsonPath('lines.0.receivedQty', 2);
        $this->postJson('/api/v1/purchase/serials/check', ['serial' => '5CG1111AAA', 'productId' => $this->product])->assertJsonPath('reason', 'duplicate_in_stock');

        // Stock, serials, ledger
        $this->getJson('/api/v1/inventory/stock')->assertOk()->assertJsonPath('0.inStock', 2)->assertJsonPath('0.rejected', 1);
        $this->getJson('/api/v1/inventory/serials?q=5cg1111aab')->assertOk()->assertJsonCount(1);
        $this->getJson('/api/v1/inventory/serials/5CG1111AAA')->assertOk()->assertJsonPath('timeline.0.type', 'received')
            ->assertJsonPath('grnNumber', $grn['number'])->assertJsonPath('supplierName', 'Sample Traders');
        $this->getJson('/api/v1/inventory/ledger')->assertOk()->assertJsonCount(2);

        // Labels: GRN ke serials, print, reprint wajah ke baghair nahi
        $this->getJson('/api/v1/labels/grns')->assertOk()->assertJson([$grn['number']]);
        $items = $this->getJson('/api/v1/labels/items?kind=serial&q=&grn='.$grn['number'])->assertOk()->json();
        $this->assertCount(2, $items);
        $this->assertSame('Dell Latitude 5440', $items[0]['name']);
        $this->getJson('/api/v1/labels/items?kind=sku')->assertOk()->assertJsonPath('0.code', 'LAP-DELL-001')->assertJsonPath('0.price', 165000);
        $tpl = $this->getJson('/api/v1/labels/templates')->assertOk()->json('0.id');
        $this->postJson('/api/v1/labels/print-log', ['templateId' => $tpl, 'codes' => ['5CG1111AAA'], 'reason' => null])->assertCreated()->assertJsonPath('isReprint', false);
        $this->postJson('/api/v1/labels/print-log', ['templateId' => $tpl, 'codes' => ['5CG1111AAA'], 'reason' => null])->assertStatus(422);
        $this->postJson('/api/v1/labels/print-log', ['templateId' => $tpl, 'codes' => ['5CG1111AAA'], 'reason' => 'Label got wet in rain'])->assertCreated()->assertJsonPath('isReprint', true);
        $this->getJson('/api/v1/labels/lookup/5cg1111aaa')->assertOk()->assertJsonPath('printCount', 2);
        $this->getJson('/api/v1/labels/print-log')->assertOk()->assertJsonCount(2);

        // Transfer: request -> approve -> dispatch -> receive
        $t = $this->postJson('/api/v1/inventory/transfers', ['fromWarehouseId' => $this->wh1, 'toWarehouseId' => $this->wh2, 'serials' => ['5CG1111AAB'], 'note' => null])
            ->assertCreated()->assertJsonPath('status', 'requested')->json();
        $this->postJson('/api/v1/inventory/transfers', ['fromWarehouseId' => $this->wh1, 'toWarehouseId' => $this->wh2, 'serials' => ['5CG1111AAB']])->assertStatus(422);
        $this->postJson("/api/v1/inventory/transfers/{$t['id']}/receive", ['serials' => ['5CG1111AAB']])->assertStatus(409);
        $this->postJson("/api/v1/inventory/transfers/{$t['id']}/approve")->assertOk();
        $this->postJson("/api/v1/inventory/transfers/{$t['id']}/dispatch")->assertOk()->assertJsonPath('status', 'in_transit');
        $this->getJson('/api/v1/inventory/serials/5CG1111AAB')->assertJsonPath('warehouseId', 0);
        $this->postJson("/api/v1/inventory/transfers/{$t['id']}/receive", ['serials' => ['5CG1111AAB']])->assertOk()
            ->assertJsonPath('status', 'received')->assertJsonPath('receivedSerials', ['5CG1111AAB']);
        $this->getJson('/api/v1/inventory/serials/5CG1111AAB')->assertJsonPath('warehouseId', $this->wh2);

        // Landed cost, bill, matching
        $this->putJson("/api/v1/purchase/grns/{$grn['id']}/landed-cost", ['items' => [['label' => 'Freight', 'amount' => 3000]]])->assertOk()->assertJsonPath('items.0.amount', 3000);
        $this->postJson("/api/v1/purchase/orders/{$po['id']}/bill", ['number' => 'INV-77', 'billDate' => '2026-11-21', 'amount' => 280000])->assertOk();
        $this->getJson("/api/v1/purchase/orders/{$po['id']}/matching")->assertOk()->assertJsonPath('bill.number', 'INV-77')->assertJsonPath('grnNumbers', [$grn['number']]);

        // Return + ledger + payment
        $this->getJson('/api/v1/purchase/returns/serial/5CG1111AAA')->assertOk()->assertJsonPath('unitCost', 140000);
        $this->getJson('/api/v1/purchase/returns/serial/5CG1111AAC')->assertStatus(404); // rejected
        $this->postJson('/api/v1/purchase/returns', ['supplierId' => $sup, 'serials' => ['5CG1111AAA'], 'reason' => 'short'])->assertStatus(422);
        $this->postJson('/api/v1/purchase/returns', ['supplierId' => $sup, 'serials' => ['5CG1111AAA'], 'reason' => 'Keyboard not working'])
            ->assertCreated()->assertJsonPath('total', 140000);
        $this->getJson('/api/v1/purchase/returns/serial/5CG1111AAA')->assertStatus(409);
        $this->getJson('/api/v1/inventory/serials/5CG1111AAA')->assertJsonPath('status', 'returned')->assertJsonPath('timeline.1.type', 'returned');

        $ledger = $this->getJson("/api/v1/purchase/suppliers/{$sup}/ledger")->assertOk()->json('entries');
        $owed = array_sum(array_column($ledger, 'increase')) - array_sum(array_column($ledger, 'decrease'));
        $this->assertEquals(140000, $owed); // 2 x 140000 - 1 return
        $this->postJson('/api/v1/purchase/payments', ['supplierId' => $sup, 'date' => '2026-11-21', 'amount' => 150000, 'method' => 'cash', 'reference' => '', 'note' => null])->assertStatus(422);
        $this->postJson('/api/v1/purchase/payments', ['supplierId' => $sup, 'date' => '2026-11-21', 'amount' => 100000, 'method' => 'bank_transfer', 'reference' => 'TXN-1', 'note' => null])
            ->assertCreated()->assertJsonPath('createdBy', 'Boss');
        $this->getJson("/api/v1/purchase/payments?supplierId={$sup}")->assertOk()->assertJsonCount(1);
    }

    /** GRN se 3 serials stock mein (helper). */
    private function receive(array $serials): void
    {
        $sup = $this->postJson('/api/v1/purchase/suppliers', ['name' => 'S'.count($serials).uniqid(), 'paymentTermsDays' => 0, 'isActive' => true])->json('id');
        $po = $this->postJson('/api/v1/purchase/orders', ['supplierId' => $sup, 'warehouseId' => $this->wh1, 'orderDate' => now()->toDateString(),
            'lines' => [['productId' => $this->product, 'qty' => count($serials), 'unitCost' => 100]]])->json('id');
        $this->postJson("/api/v1/purchase/orders/{$po}/submit");
        $this->postJson("/api/v1/purchase/orders/{$po}/approve");
        $grn = $this->postJson('/api/v1/purchase/grns', ['poId' => $po])->json('id');
        $this->postJson("/api/v1/purchase/grns/{$grn}/post", ['lines' => [['productId' => $this->product, 'qty' => 0,
            'serials' => array_map(fn ($s) => ['serial' => $s, 'status' => 'accepted', 'note' => null], $serials)]]])->assertOk();
    }

    public function test_counts_adjustments_and_reservations(): void
    {
        $this->receive(['S0000001', 'S0000002', 'S0000003']);

        // Count: expected 3, counted 2, approve
        $c = $this->postJson('/api/v1/inventory/counts', ['warehouseId' => $this->wh1, 'note' => null])->assertCreated()->assertJsonCount(3, 'expected')->json();
        $this->postJson('/api/v1/inventory/counts', ['warehouseId' => $this->wh1])->assertStatus(422);
        $this->postJson('/api/v1/inventory/counts', ['warehouseId' => $this->wh2])->assertStatus(422); // khaali
        $this->postJson("/api/v1/inventory/counts/{$c['id']}/approve")->assertStatus(409);
        $this->postJson("/api/v1/inventory/counts/{$c['id']}/submit", ['serials' => ['s0000001', 'S0000002']])->assertOk()
            ->assertJsonPath('status', 'submitted')->assertJsonCount(2, 'counted');
        $this->postJson("/api/v1/inventory/counts/{$c['id']}/reject", ['note' => 'short'])->assertStatus(422);
        $this->postJson("/api/v1/inventory/counts/{$c['id']}/approve")->assertOk()->assertJsonPath('status', 'approved');

        // Reservation: S1 hold; transfer/adjust/return blocked; release
        $r = $this->postJson('/api/v1/inventory/reservations', ['customerName' => 'Ali Traders', 'note' => null, 'holdUntil' => now()->addDays(2)->toDateString(), 'serials' => ['S0000001']])
            ->assertCreated()->assertJsonPath('status', 'active')->json();
        $this->postJson('/api/v1/inventory/reservations', ['customerName' => 'Other', 'serials' => ['S0000001']])->assertStatus(422);
        $this->postJson('/api/v1/inventory/reservations', ['customerName' => 'Other', 'holdUntil' => '2020-01-01', 'serials' => ['S0000002']])->assertStatus(422);
        $this->getJson('/api/v1/inventory/serials/S0000001')->assertJsonPath('reservedRef', $r['number'])->assertJsonPath('timeline.1.type', 'reserved');
        $this->getJson('/api/v1/inventory/stock')->assertJsonPath('0.reserved', 1)->assertJsonPath('0.inStock', 3);
        $this->postJson('/api/v1/inventory/transfers', ['fromWarehouseId' => $this->wh1, 'toWarehouseId' => $this->wh2, 'serials' => ['S0000001']])->assertStatus(422);
        $this->postJson('/api/v1/inventory/adjustments', ['kind' => 'damage', 'serials' => ['S0000001'], 'reason' => 'Dropped from the shelf'])->assertStatus(422);
        $this->postJson("/api/v1/inventory/reservations/{$r['id']}/release")->assertOk()->assertJsonPath('status', 'released');
        $this->postJson("/api/v1/inventory/reservations/{$r['id']}/release")->assertStatus(409);
        $this->getJson('/api/v1/inventory/serials/S0000001')->assertJsonPath('reservedRef', null);

        // Adjustment: quarantine -> approve; release request; reject needs reason
        $a = $this->postJson('/api/v1/inventory/adjustments', ['kind' => 'quarantine', 'serials' => ['S0000002'], 'reason' => 'Battery swelling seen'])
            ->assertCreated()->assertJsonPath('status', 'pending')->assertJsonPath('lines.0.to', 'quarantine')->json();
        $this->postJson('/api/v1/inventory/adjustments', ['kind' => 'damage', 'serials' => ['S0000002'], 'reason' => 'Another request here'])->assertStatus(422);
        $this->postJson('/api/v1/inventory/adjustments', ['kind' => 'release', 'serials' => ['S0000003'], 'reason' => 'Not in quarantine'])->assertStatus(422);
        $this->postJson("/api/v1/inventory/adjustments/{$a['id']}/approve")->assertOk()->assertJsonPath('status', 'approved');
        $this->getJson('/api/v1/inventory/serials/S0000002')->assertJsonPath('status', 'quarantine')->assertJsonPath('timeline.1.type', 'adjusted');
        $d = $this->postJson('/api/v1/inventory/adjustments', ['kind' => 'damage', 'serials' => ['S0000002'], 'reason' => 'Battery leaked badly'])->assertCreated()->json();
        $this->postJson("/api/v1/inventory/adjustments/{$d['id']}/reject", ['note' => 'no'])->assertStatus(422);
        $this->postJson("/api/v1/inventory/adjustments/{$d['id']}/reject", ['note' => 'Supplier will replace it'])->assertOk()->assertJsonPath('status', 'rejected');

        // Ledger mein sirf asli aana-jaana
        $this->assertSame(['in'], array_values(array_unique(array_column($this->getJson('/api/v1/inventory/ledger')->json(), 'direction'))));
    }

    public function test_permissions_protect_purchase_routes(): void
    {
        $staff = User::create(['name' => 'Cashier', 'email' => 'c@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'cashier', 'is_active' => true]);
        $this->actingAs($staff, 'sanctum');
        $this->postJson('/api/v1/purchase/suppliers', ['name' => 'X', 'paymentTermsDays' => 0, 'isActive' => true])->assertForbidden();
        $this->getJson('/api/v1/inventory/transfers')->assertForbidden();
    }
}
