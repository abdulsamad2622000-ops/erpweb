<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Step 13: ledger running balance, FIFO + manual receipts, aging buckets. */
class CustomerLedgerTest extends TestCase
{
    use RefreshDatabase;

    private int $cust;

    private function bill(string $no, float $total, float $paid, string $created, string $due): int
    {
        return DB::table('sales')->insertGetId(['number' => $no, 'channel' => 'wholesale', 'warehouse_id' => $this->wh, 'customer_id' => $this->cust,
            'subtotal' => $total, 'discount' => 0, 'total' => $total, 'paid' => $paid, 'change_due' => 0, 'due_date' => $due,
            'created_at' => $created, 'updated_at' => $created]);
    }

    private int $wh;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password', 'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $this->actingAs($boss, 'sanctum')->withHeader('X-Client', 'erp-web');
        $b = DB::table('branches')->insertGetId(['name' => 'K', 'created_at' => now(), 'updated_at' => now()]);
        $this->wh = DB::table('warehouses')->insertGetId(['branch_id' => $b, 'code' => 'M', 'name' => 'Main', 'type' => 'main', 'created_at' => now(), 'updated_at' => now()]);
        $this->cust = $this->postJson('/api/v1/customers', ['name' => 'Ali', 'phone' => '03001112223', 'type' => 'wholesale', 'creditLimit' => 1000000])->json('id');
    }

    public function test_ledger_receipts_and_aging(): void
    {
        $a = $this->bill('INV-A', 100000, 0, now()->subDays(100)->toDateTimeString(), now()->subDays(95)->toDateString()); // 95 late
        $b = $this->bill('INV-B', 50000, 10000, now()->subDays(40)->toDateTimeString(), now()->subDays(35)->toDateString()); // 35 late
        $this->bill('INV-C', 30000, 0, now()->subDay()->toDateTimeString(), now()->addDays(29)->toDateString()); // not due
        DB::table('sale_payments')->insert(['sale_id' => $b, 'method' => 'cash', 'amount' => 10000, 'paid_at' => now()->subDays(40)]);

        $ag = $this->getJson('/api/v1/customers/aging')->assertOk()->json();
        $this->assertSame(['current' => 30000, 'd30' => 0, 'd60' => 40000, 'd90' => 0, 'over90' => 100000, 'total' => 170000],
            array_intersect_key($ag['rows'][0], array_flip(['current', 'd30', 'd60', 'd90', 'over90', 'total'])));

        $this->postJson("/api/v1/customers/{$this->cust}/receipts", ['method' => 'transfer', 'amount' => 999999])->assertStatus(422);
        // FIFO: 120000 -> A fully (100000), B 20000
        $r = $this->postJson("/api/v1/customers/{$this->cust}/receipts", ['method' => 'transfer', 'amount' => 120000, 'reference' => 'TRX9'],
            ['Idempotency-Key' => 'r1'])->assertCreated()->assertJsonPath('allocations.0.number', 'INV-A')->assertJsonPath('allocations.1.amount', 20000)->json();
        $this->postJson("/api/v1/customers/{$this->cust}/receipts", ['method' => 'transfer', 'amount' => 120000], ['Idempotency-Key' => 'r1'])->assertCreated();
        $this->assertSame(1, DB::table('customer_receipts')->count());
        $this->getJson("/api/v1/sales/invoices/{$a}")->assertJsonPath('status', 'paid');

        // Manual allocation must add up and fit
        $this->postJson("/api/v1/customers/{$this->cust}/receipts", ['method' => 'cash', 'amount' => 5000,
            'allocations' => [['invoiceId' => $a, 'amount' => 5000]]])->assertStatus(422);
        $this->postJson("/api/v1/customers/{$this->cust}/receipts", ['method' => 'cash', 'amount' => 5000,
            'allocations' => [['invoiceId' => $b, 'amount' => 4000]]])->assertStatus(422);

        $l = $this->getJson("/api/v1/customers/{$this->cust}/ledger")->assertOk()->json();
        $this->assertSame(50000, (int) $l['closing']); // 180000 - 10000 - 120000
        $this->assertSame(['INV-A', 'INV-B', 'payment', 'INV-C', 'receipt'], array_map(fn ($e) => $e['type'] === 'invoice' ? $e['ref'] : $e['type'], $l['entries']));
        $this->assertCount(2, $l['open']);
        $this->getJson("/api/v1/customer-receipts/{$r['id']}")->assertOk()->assertJsonPath('number', $r['number']);

        $from = now()->subDays(10)->toDateString();
        $this->getJson("/api/v1/customers/{$this->cust}/ledger?from={$from}")->assertJsonPath('opening', 140000)->assertJsonPath('closing', 50000);
    }
}
