<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Kharche + cash book + P&L, email templates/send, repair parts stock se. */
class AccountsEmailTest extends TestCase
{
    use RefreshDatabase;

    private int $wh;

    protected function setUp(): void
    {
        parent::setUp();
        config(['mail.default' => 'array']);
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password', 'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $this->actingAs($boss, 'sanctum')->withHeader('X-Client', 'erp-web');
        $b = DB::table('branches')->insertGetId(['name' => 'K', 'created_at' => now(), 'updated_at' => now()]);
        $this->wh = DB::table('warehouses')->insertGetId(['branch_id' => $b, 'code' => 'M', 'name' => 'Main', 'type' => 'main', 'created_at' => now(), 'updated_at' => now()]);
    }

    public function test_expenses_cashbook_and_profit(): void
    {
        $cat = DB::table('expense_categories')->where('name', 'Rent')->value('id');
        $this->postJson('/api/v1/accounts/expenses', ['date' => now()->addDay()->toDateString(), 'categoryId' => $cat, 'amount' => 5000, 'method' => 'cash'])->assertStatus(422);
        $e = $this->postJson('/api/v1/accounts/expenses', ['date' => now()->toDateString(), 'categoryId' => $cat, 'amount' => 5000, 'method' => 'cash', 'paidTo' => 'Landlord'])
            ->assertCreated()->assertJsonPath('category', 'Rent')->json();
        $this->postJson('/api/v1/accounts/expenses', ['date' => now()->toDateString(), 'categoryId' => $cat, 'amount' => 1000, 'method' => 'transfer'])->assertCreated();
        $this->getJson('/api/v1/accounts/expenses')->assertJsonPath('total', 2)->assertJsonPath('sum', 6000);
        $this->postJson('/api/v1/accounts/expense-categories', ['name' => 'rent'])->assertStatus(422);

        // POS cash sale 10000 (paid 12000, change 2000)
        DB::table('sales')->insert(['number' => 'INV-1', 'channel' => 'pos', 'warehouse_id' => $this->wh, 'subtotal' => 10000, 'discount' => 0, 'total' => 10000,
            'paid' => 12000, 'change_due' => 2000, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sale_payments')->insert(['sale_id' => 1, 'method' => 'cash', 'amount' => 12000]);

        $cb = $this->getJson('/api/v1/accounts/cashbook')->assertOk()->json();
        $this->assertSame(0, (int) $cb['opening']);
        $this->assertSame(12000, (int) $cb['totalIn']);
        $this->assertSame(7000, (int) $cb['totalOut']); // change 2000 + rent 5000
        $this->assertSame(5000, (int) $cb['closing']);
        $this->getJson('/api/v1/accounts/cashbook?method=transfer')->assertJsonPath('totalOut', 1000);

        $this->postJson("/api/v1/accounts/expenses/{$e['id']}/void", ['reason' => 'short'])->assertStatus(422);
        $this->postJson("/api/v1/accounts/expenses/{$e['id']}/void", ['reason' => 'Entered twice by mistake'])->assertOk()->assertJsonPath('voided', true);
        $this->getJson('/api/v1/reports/profit')->assertOk()->assertJsonPath('salesRevenue', 10000)->assertJsonPath('expenses', 1000)
            ->assertJsonPath('netProfit', 9000);
        $this->getJson('/api/v1/dashboard')->assertJsonPath('monthExpenses', 1000)->assertJsonPath('todayCash', 10000);
    }

    public function test_email_templates_and_send(): void
    {
        $this->getJson('/api/v1/email/templates')->assertOk()->assertJsonCount(3, 'templates')->assertJsonPath('mailer', 'array');
        $this->putJson('/api/v1/email/templates/invoice', ['subject' => 'Bill {{number}}', 'body' => 'Hi {{customer}}, total {{total}}'])->assertOk()
            ->assertJsonPath('subject', 'Bill {{number}}');
        $this->postJson('/api/v1/email/templates/repair_ready/test', ['to' => 'me@t.test'])->assertOk()->assertJsonPath('status', 'sent');

        $c = $this->postJson('/api/v1/customers', ['name' => 'Ali', 'phone' => '03001112223'])->json('id');
        DB::table('sales')->insert(['number' => 'INV-9', 'channel' => 'wholesale', 'warehouse_id' => $this->wh, 'customer_id' => $c, 'subtotal' => 500, 'discount' => 0,
            'total' => 500, 'paid' => 0, 'change_due' => 0, 'created_at' => now(), 'updated_at' => now()]);
        $sid = DB::table('sales')->where('number', 'INV-9')->value('id');
        $this->postJson("/api/v1/sales/invoices/{$sid}/email")->assertStatus(422)->assertJsonValidationErrors('to');
        $this->postJson("/api/v1/sales/invoices/{$sid}/email", ['to' => 'ali@t.test'])->assertOk()->assertJsonPath('subject', 'Bill INV-9');
        $this->postJson("/api/v1/customers/{$c}/statement-email", ['to' => 'ali@t.test'])->assertOk();
        $this->getJson('/api/v1/email/logs')->assertJsonPath('total', 3)->assertJsonPath('data.0.status', 'sent');

        config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 1, 'mail.mailers.smtp.timeout' => 1]);
        app()->forgetInstance('mail.manager');
        $this->postJson("/api/v1/sales/invoices/{$sid}/email", ['to' => 'ali@t.test'])->assertStatus(422);
        $this->assertSame('failed', DB::table('email_logs')->orderByDesc('id')->value('status'));
    }

    public function test_repair_part_from_stock(): void
    {
        $brand = DB::table('brands')->insertGetId(['name' => 'K', 'created_at' => now(), 'updated_at' => now()]);
        $p = $this->postJson('/api/v1/products', ['sku' => 'RAM-8', 'name' => 'RAM 8GB', 'barcode' => null, 'brandId' => $brand, 'categoryId' => null,
            'trackBatch' => false, 'specs' => ['cpu' => '-', 'ram' => '8 GB', 'storage' => '-'], 'warrantyMonths' => 0, 'costPrice' => 4000, 'minPrice' => null,
            'prices' => [['tier' => 'retail', 'price' => 6000]], 'reorderLevels' => [], 'variants' => [], 'images' => [], 'isActive' => true])->json('id');
        DB::table('stock_serials')->insert(['serial' => 'RAM1', 'product_id' => $p, 'warehouse_id' => $this->wh, 'status' => 'in_stock', 'unit_cost' => 4000,
            'created_at' => now(), 'updated_at' => now()]);
        $j = $this->postJson('/api/v1/warranty/jobs', ['device' => 'Dell', 'problem' => 'Slow laptop', 'customerName' => 'Z', 'customerPhone' => '03001231231'])->json('id');
        $this->putJson("/api/v1/warranty/jobs/{$j}", ['parts' => [['description' => 'RAM 8GB', 'qty' => 1, 'unitPrice' => 6000, 'serial' => 'nope']]])->assertStatus(422);
        $this->putJson("/api/v1/warranty/jobs/{$j}", ['labour' => 1000, 'parts' => [['description' => 'RAM 8GB', 'qty' => 1, 'unitPrice' => 6000, 'serial' => 'ram1']]])
            ->assertOk()->assertJsonPath('parts.0.serial', 'RAM1')->assertJsonPath('total', 7000);
        $this->assertSame('consumed', DB::table('stock_serials')->where('serial', 'RAM1')->value('status'));
        // dobara save: dobara nahi katna
        $this->putJson("/api/v1/warranty/jobs/{$j}", ['parts' => [['description' => 'RAM 8GB', 'qty' => 1, 'unitPrice' => 6000, 'serial' => 'RAM1']]])->assertOk();
        $this->assertSame(1, DB::table('stock_movements')->where('serial', 'RAM1')->where('type', 'repair')->count());
        foreach (['diagnosing', 'repairing', 'ready'] as $s) {
            $this->postJson("/api/v1/warranty/jobs/{$j}/status", ['status' => $s])->assertOk();
        }
        $this->postJson("/api/v1/warranty/jobs/{$j}/deliver", ['amount' => 7000, 'method' => 'cash'])->assertOk();
        $this->getJson('/api/v1/reports/profit')->assertJsonPath('repairIncome', 7000)->assertJsonPath('repairPartsCost', 4000)->assertJsonPath('grossProfit', 3000);

        // Cancel releases part
        $j2 = $this->postJson('/api/v1/warranty/jobs', ['device' => 'HP', 'problem' => 'Slow laptop', 'customerName' => 'Z', 'customerPhone' => '03001231231'])->json('id');
        DB::table('stock_serials')->insert(['serial' => 'RAM2', 'product_id' => $p, 'warehouse_id' => $this->wh, 'status' => 'in_stock', 'unit_cost' => 4000,
            'created_at' => now(), 'updated_at' => now()]);
        $this->putJson("/api/v1/warranty/jobs/{$j2}", ['parts' => [['description' => 'RAM', 'qty' => 1, 'unitPrice' => 6000, 'serial' => 'RAM2']]])->assertOk();
        $this->postJson("/api/v1/warranty/jobs/{$j2}/status", ['status' => 'cancelled', 'note' => 'Customer said no'])->assertOk();
        $this->assertSame('in_stock', DB::table('stock_serials')->where('serial', 'RAM2')->value('status'));
    }
}
