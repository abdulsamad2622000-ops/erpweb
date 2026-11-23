<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Har API route: ghalat id (999999), khaali body, ajeeb query — kabhi 500 nahi, hamesha 4xx (ya 2xx).
 * Cashier se bhi: permission wali routes 403, 500 nahi.
 */
class AllRoutesBadInputSmokeTest extends TestCase
{
    use RefreshDatabase;

    private function sweep(User $u): array
    {
        $this->actingAs($u, 'sanctum')->withHeader('X-Client', 'erp-web');
        $failed = [];
        foreach (Route::getRoutes() as $r) {
            $uri = $r->uri();
            if (! str_starts_with($uri, 'api/') || str_contains($uri, 'logout')) {
                continue;
            }
            $path = '/'.preg_replace('/\{[^}]+\}/', '999999', $uri);
            foreach (array_diff($r->methods(), ['HEAD', 'OPTIONS']) as $m) {
                foreach ([[], ['x' => 'y', 'lines' => 'bad', 'amount' => 'abc', 'items' => [['a' => 1]]]] as $body) {
                    $res = $this->json($m, $path.'?page=abc&pageSize=-5&sort=;drop', $body);
                    if ($res->status() >= 500) {
                        $failed[] = "{$m} {$path} => {$res->status()} ".substr((string) $res->getContent(), 0, 200);
                    }
                }
            }
        }

        return $failed;
    }

    public function test_super_admin_never_gets_server_error(): void
    {
        $this->seed(RoleSeeder::class);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password', 'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true]);
        $failed = $this->sweep($boss);
        $this->assertSame([], $failed, implode("\n", $failed));
    }

    public function test_cashier_never_gets_server_error(): void
    {
        $this->seed(RoleSeeder::class);
        $c = User::create(['name' => 'C', 'email' => 'c@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'cashier', 'is_active' => true]);
        $failed = $this->sweep($c);
        $this->assertSame([], $failed, implode("\n", $failed));
    }
}
