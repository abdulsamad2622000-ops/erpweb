<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Step 14: warranty check, job card, status flow, parts, delivery with charges. */
class RepairFlowTest extends TestCase
{
    use RefreshDatabase;

    private int $sale;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password', 'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $this->actingAs($boss, 'sanctum')->withHeader('X-Client', 'erp-web');
        $b = DB::table('branches')->insertGetId(['name' => 'K', 'created_at' => now(), 'updated_at' => now()]);
        $wh = DB::table('warehouses')->insertGetId(['branch_id' => $b, 'code' => 'M', 'name' => 'Main', 'type' => 'main', 'created_at' => now(), 'updated_at' => now()]);
        $brand = DB::table('brands')->insertGetId(['name' => 'HP', 'created_at' => now(), 'updated_at' => now()]);
        $p = $this->postJson('/api/v1/products', ['sku' => 'LAP-HP-9', 'name' => 'HP ProBook', 'barcode' => null, 'brandId' => $brand, 'categoryId' => null,
            'trackBatch' => false, 'specs' => ['cpu' => 'i5', 'ram' => '8 GB', 'storage' => '256 GB'], 'warrantyMonths' => 6, 'costPrice' => 1, 'minPrice' => null,
            'prices' => [['tier' => 'retail', 'price' => 100]], 'reorderLevels' => [], 'variants' => [], 'images' => [], 'isActive' => true])->json('id');
        $c = $this->postJson('/api/v1/customers', ['name' => 'Bilal', 'phone' => '03004445556'])->json('id');
        $this->sale = DB::table('sales')->insertGetId(['number' => 'INV-1', 'channel' => 'pos', 'warehouse_id' => $wh, 'customer_id' => $c, 'subtotal' => 100,
            'discount' => 0, 'total' => 100, 'paid' => 100, 'change_due' => 0, 'created_at' => now()->subMonths(2), 'updated_at' => now()]);
        DB::table('sale_lines')->insert(['sale_id' => $this->sale, 'product_id' => $p, 'serial' => 'HPSN1', 'qty' => 1, 'unit_price' => 100, 'warranty_months' => 6]);
        DB::table('sale_lines')->insert(['sale_id' => $this->sale, 'product_id' => $p, 'serial' => 'HPOLD', 'qty' => 1, 'unit_price' => 100, 'warranty_months' => 1]);
    }

    public function test_job_card_flow(): void
    {
        $this->getJson('/api/v1/warranty/check/hpsn1')->assertOk()->assertJsonPath('warranty', 'in_warranty')
            ->assertJsonPath('productName', 'HP ProBook')->assertJsonPath('customer.name', 'Bilal')->assertJsonPath('sale.number', 'INV-1');
        $this->getJson('/api/v1/warranty/check/HPOLD')->assertJsonPath('warranty', 'expired');
        $this->getJson('/api/v1/warranty/check/OTHER1')->assertJsonPath('warranty', 'not_ours');

        $j = $this->postJson('/api/v1/warranty/jobs', ['serial' => 'HPSN1', 'problem' => 'Screen flickers', 'accessories' => 'Charger'])
            ->assertCreated()->assertJsonPath('warranty', 'in_warranty')->assertJsonPath('customerName', 'Bilal')->assertJsonPath('device', 'HP ProBook')
            ->assertJsonPath('next', ['diagnosing', 'cancelled'])->json();
        $this->postJson('/api/v1/warranty/jobs', ['serial' => 'HPSN1', 'problem' => 'Again'])->assertStatus(422);
        $this->postJson('/api/v1/warranty/jobs', ['device' => 'Dell from outside', 'problem' => 'No power', 'customerName' => 'Z'])->assertStatus(422);
        $this->postJson('/api/v1/warranty/jobs', ['device' => 'Dell from outside', 'problem' => 'No power', 'customerName' => 'Zain', 'customerPhone' => '0311-2223334'])
            ->assertCreated()->assertJsonPath('warranty', 'not_ours');

        $id = $j['id'];
        $this->postJson("/api/v1/warranty/jobs/{$id}/status", ['status' => 'ready'])->assertStatus(422);
        $this->postJson("/api/v1/warranty/jobs/{$id}/status", ['status' => 'diagnosing'])->assertOk();
        $this->putJson("/api/v1/warranty/jobs/{$id}", ['diagnosis' => 'Loose cable', 'labour' => 500,
            'parts' => [['description' => 'Display cable', 'qty' => 1, 'unitPrice' => 1500]]])->assertOk()->assertJsonPath('total', 2000);
        $this->postJson("/api/v1/warranty/jobs/{$id}/status", ['status' => 'repairing'])->assertOk();
        $this->postJson("/api/v1/warranty/jobs/{$id}/deliver", ['amount' => 2000, 'method' => 'cash'])->assertStatus(409);
        $this->postJson("/api/v1/warranty/jobs/{$id}/status", ['status' => 'ready', 'note' => 'Tested 1 hour'])->assertOk();
        $this->postJson("/api/v1/warranty/jobs/{$id}/deliver", ['amount' => 1000, 'method' => 'cash'])->assertStatus(422);
        $this->postJson("/api/v1/warranty/jobs/{$id}/deliver", ['amount' => 2000, 'method' => 'cash'])->assertOk()
            ->assertJsonPath('status', 'delivered')->assertJsonPath('paid', 2000)->assertJsonCount(5, 'events');
        $this->putJson("/api/v1/warranty/jobs/{$id}", ['labour' => 0])->assertStatus(409);

        $this->getJson('/api/v1/warranty/jobs?status=open')->assertJsonPath('total', 1);
        $this->getJson('/api/v1/warranty/jobs?search=0311')->assertJsonPath('total', 1);
        $this->getJson('/api/v1/warranty/check/HPSN1')->assertJsonPath('openJob', null);
    }

    public function test_cancel_needs_reason_and_permission(): void
    {
        $id = $this->postJson('/api/v1/warranty/jobs', ['device' => 'Lenovo', 'problem' => 'Keyboard', 'customerName' => 'Ali', 'customerPhone' => '03001231231'])->json('id');
        $this->postJson("/api/v1/warranty/jobs/{$id}/status", ['status' => 'cancelled'])->assertStatus(422);
        $this->postJson("/api/v1/warranty/jobs/{$id}/status", ['status' => 'cancelled', 'note' => 'Customer took it back'])->assertOk();
        $acc = User::create(['name' => 'A', 'email' => 'a@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'accountant', 'is_active' => true]);
        $this->actingAs($acc, 'sanctum')->getJson('/api/v1/warranty/jobs')->assertForbidden();
    }
}
