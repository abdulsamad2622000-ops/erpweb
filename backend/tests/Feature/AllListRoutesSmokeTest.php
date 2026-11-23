<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/** Har GET API route (bina {id}) super admin se, list params ke saath: koi 500 nahi. Warehouse delete jo istemal mein ho: 422/409. */
class AllListRoutesSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_get_route_answers_without_server_error(): void
    {
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password', 'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $this->actingAs($boss, 'sanctum')->withHeader('X-Client', 'erp-web');
        $failed = [];
        foreach (Route::getRoutes() as $r) {
            $uri = $r->uri();
            if (! in_array('GET', $r->methods(), true) || ! str_starts_with($uri, 'api/') || str_contains($uri, '{')) {
                continue;
            }
            foreach (['', '?page=1&pageSize=20&search=a&sort=number:desc&status=open'] as $q) {
                $res = $this->getJson('/'.$uri.$q);
                if ($res->status() >= 500) {
                    $failed[] = "{$uri}{$q} => {$res->status()} ".substr((string) $res->getContent(), 0, 160);
                }
            }
        }
        $this->assertSame([], $failed, implode("\n", $failed));
    }

    public function test_used_warehouse_cannot_be_deleted_cleanly(): void
    {
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password', 'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $this->actingAs($boss, 'sanctum')->withHeader('X-Client', 'erp-web');
        $b = DB::table('branches')->insertGetId(['name' => 'K', 'created_at' => now(), 'updated_at' => now()]);
        $wh = DB::table('warehouses')->insertGetId(['branch_id' => $b, 'code' => 'S', 'name' => 'Show', 'type' => 'showroom', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('pos_shifts')->insert(['user_id' => $boss->id, 'warehouse_id' => $wh, 'opening_cash' => 0, 'opened_at' => now()]);
        $res = $this->deleteJson("/api/v1/warehouses/{$wh}");
        $this->assertContains($res->status(), [409, 422]);
        $this->assertStringContainsString('inactive', (string) $res->getContent());
    }
}
