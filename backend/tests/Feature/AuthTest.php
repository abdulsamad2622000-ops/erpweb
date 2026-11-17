<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Browser jaisi request: Sanctum session sirf stateful frontend se lagata hai
        config(['sanctum.stateful' => ['localhost:4300']]);
        $this->withHeaders(['Origin' => 'http://localhost:4300', 'Referer' => 'http://localhost:4300/']);
        config(['permission_keys' => ['dashboard.view.view', 'settings.manage', 'products.product.view']]);
        $this->seed(DemoSeeder::class);
    }

    public function test_staff_login_has_no_two_factor(): void
    {
        $this->postJson('/api/v1/auth/login', ['email' => 'keeper@demo.test', 'password' => 'password'])
            ->assertOk()->assertJson(['twoFactorRequired' => false]);
    }

    public function test_wrong_password_is_rejected(): void
    {
        $this->postJson('/api/v1/auth/login', ['email' => 'keeper@demo.test', 'password' => 'nope'])
            ->assertStatus(422);
    }

    public function test_admin_login_requires_two_factor(): void
    {
        $this->postJson('/api/v1/auth/login', ['email' => 'admin@demo.test', 'password' => 'password'])
            ->assertOk()->assertJson(['twoFactorRequired' => true, 'method' => 'email', 'maskedEmail' => 'ad***@demo.test']);
    }

    public function test_two_factor_wrong_code_is_422_and_right_code_is_ok(): void
    {
        $admin = User::where('email', 'admin@demo.test')->first();
        Cache::put("otp:{$admin->id}", Hash::make('123456'), 600);

        $this->withSession(['2fa.user_id' => $admin->id])
            ->postJson('/api/v1/auth/two-factor', ['code' => '000000'])->assertStatus(422);

        $this->withSession(['2fa.user_id' => $admin->id])
            ->postJson('/api/v1/auth/two-factor', ['code' => '123456'])->assertOk();
    }

    public function test_two_factor_without_pending_login_is_401(): void
    {
        $this->postJson('/api/v1/auth/two-factor', ['code' => '123456'])->assertStatus(401);
    }

    public function test_me_requires_login(): void
    {
        $this->getJson('/api/v1/me')->assertStatus(401);
    }

    public function test_me_returns_frontend_shape_for_admin_without_settings(): void
    {
        $admin = User::where('email', 'admin@demo.test')->first();

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/me')->assertOk();
        $res->assertJsonPath('user.type', 'admin')
            ->assertJsonPath('user.isSuperAdmin', false)
            ->assertJsonCount(2, 'branches')
            ->assertJsonPath('limits.discountPercent', 5);

        $keys = collect($res->json('permissions'))->pluck('key');
        $this->assertTrue($keys->contains('dashboard.view.view'));
        $this->assertFalse($keys->contains('settings.manage'));
    }

    public function test_keeper_has_one_branch_and_only_inventory_keys(): void
    {
        $keeper = User::where('email', 'keeper@demo.test')->first();

        $this->actingAs($keeper, 'sanctum')->getJson('/api/v1/me')->assertOk()
            ->assertJsonCount(1, 'branches')
            ->assertJsonCount(6, 'permissions');
    }
}