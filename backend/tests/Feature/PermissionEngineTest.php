<?php

namespace Tests\Feature;

use App\Exceptions\LastSuperAdminException;
use App\Models\User;
use App\Services\GrantPolicy;
use App\Services\PermissionResolver;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class PermissionEngineTest extends TestCase
{
    use RefreshDatabase;

    private PermissionResolver $resolver;
    private GrantPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        config(['permission_keys' => [
            'dashboard.view.view', 'inventory.stock.view', 'inventory.serial.view',
            'settings.manage', 'products.product.view',
        ]]);
        $this->seed(RoleSeeder::class);
        $this->resolver = app(PermissionResolver::class);
        $this->policy = app(GrantPolicy::class);
    }

    private function make(string $type, string $role, string $email, bool $active = true): User
    {
        return User::create([
            'name' => $email, 'email' => $email, 'password' => 'password',
            'type' => $type, 'role' => $role, 'is_active' => $active,
        ]);
    }

    public function test_role_permissions_are_resolved(): void
    {
        $keeper = $this->make('staff', 'store_keeper', 'k@t.test');

        $this->assertTrue($this->resolver->has($keeper, 'inventory.stock.view'));
        $this->assertFalse($this->resolver->has($keeper, 'products.product.view'));
    }

    public function test_user_grant_adds_permission_and_expired_grant_is_ignored(): void
    {
        $keeper = $this->make('staff', 'store_keeper', 'k@t.test');

        $keeper->permissions()->create([
            'permission_key' => 'products.product.view', 'effect' => 'grant',
            'expires_at' => now()->subDay(),
        ]);
        $this->assertFalse($this->resolver->has($keeper, 'products.product.view'));

        $keeper->permissions()->delete();
        $keeper->permissions()->create([
            'permission_key' => 'products.product.view', 'effect' => 'grant',
            'expires_at' => now()->addDay(),
        ]);
        $this->assertTrue($this->resolver->has($keeper, 'products.product.view'));
    }

    public function test_user_deny_removes_role_permission_but_not_for_super_admin(): void
    {
        $keeper = $this->make('staff', 'store_keeper', 'k@t.test');
        $keeper->permissions()->create(['permission_key' => 'inventory.stock.view', 'effect' => 'deny']);
        $this->assertFalse($this->resolver->has($keeper, 'inventory.stock.view'));

        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $super->permissions()->create(['permission_key' => 'settings.manage', 'effect' => 'deny']);
        $this->assertTrue($this->resolver->has($super, 'settings.manage'));
    }

    public function test_admin_cannot_grant_what_it_does_not_hold(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');

        $this->assertFalse($this->policy->canGrant($admin, 'settings.manage'));
        $this->assertTrue($this->policy->canGrant($admin, 'products.product.view'));
    }

    public function test_admin_grant_is_bounded_by_its_own_limit_scope_and_expiry(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $admin->permissions()->create([
            'permission_key' => 'products.product.view', 'effect' => 'grant',
            'scope' => 'branch', 'limit_value' => 100, 'expires_at' => now()->addDays(10),
        ]);

        $this->assertTrue($this->policy->canGrant($admin, 'products.product.view', 'branch', 50, now()->addDays(5)));
        $this->assertFalse($this->policy->canGrant($admin, 'products.product.view', 'branch', 500, now()->addDays(5)));
        $this->assertFalse($this->policy->canGrant($admin, 'products.product.view', 'branch', null, now()->addDays(5)));
        $this->assertFalse($this->policy->canGrant($admin, 'products.product.view', 'all', 50, now()->addDays(5)));
        $this->assertFalse($this->policy->canGrant($admin, 'products.product.view', 'branch', 50, now()->addDays(30)));
        $this->assertFalse($this->policy->canGrant($admin, 'products.product.view', 'branch', 50, null));
    }

    public function test_who_can_manage_whom(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $staff = $this->make('staff', 'store_keeper', 'k@t.test');

        $this->assertTrue($this->policy->canManage($super, $admin));
        $this->assertTrue($this->policy->canManage($admin, $staff));
        $this->assertFalse($this->policy->canManage($admin, $admin));
        $this->assertFalse($this->policy->canManage($admin, $super));
        $this->assertFalse($this->policy->canManage($staff, $staff));
    }

    public function test_last_super_admin_cannot_be_deleted(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');

        $this->expectException(LastSuperAdminException::class);
        $super->delete();
    }

    public function test_last_super_admin_cannot_be_deactivated(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');

        $this->expectException(LastSuperAdminException::class);
        $super->update(['is_active' => false]);
    }

    public function test_last_super_admin_cannot_be_downgraded(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');

        $this->expectException(LastSuperAdminException::class);
        $super->update(['type' => 'admin']);
    }

    public function test_inactive_super_admin_does_not_count_as_a_second_one(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $this->make('super_admin', 'super_admin', 'old@t.test', false);

        $this->expectException(LastSuperAdminException::class);
        $super->delete();
    }

    public function test_super_admin_can_be_changed_when_another_active_one_exists(): void
    {
        $first = $this->make('super_admin', 'super_admin', 's1@t.test');
        $this->make('super_admin', 'super_admin', 's2@t.test');

        $first->update(['type' => 'admin']);

        $this->assertSame('admin', $first->fresh()->type);
    }

    public function test_permission_middleware_returns_401_403_and_200(): void
    {
        Route::middleware(['auth:sanctum', 'permission:inventory.stock.view'])
            ->get('/api/_perm-test', fn () => response()->json(['ok' => true]));

        $this->getJson('/api/_perm-test')->assertStatus(401);

        $sales = $this->make('staff', 'cashier', 'c@t.test');
        $this->actingAs($sales, 'sanctum')->getJson('/api/_perm-test')->assertStatus(403);

        $keeper = $this->make('staff', 'store_keeper', 'k@t.test');
        $this->actingAs($keeper, 'sanctum')->getJson('/api/_perm-test')->assertOk();
    }
}