<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use App\Services\PermissionResolver;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['permission_keys' => [
            'dashboard.view.view', 'inventory.stock.view', 'inventory.serial.view',
            'inventory.location.view', 'inventory.transfer.view', 'inventory.count.view',
            'settings.manage', 'products.product.view',
        ]]);
        $this->seed(RoleSeeder::class);
    }

    private function make(string $type, string $role, string $email, bool $active = true): User
    {
        return User::create([
            'name' => $email, 'email' => $email, 'password' => 'password',
            'type' => $type, 'role' => $role, 'is_active' => $active,
        ]);
    }

    private function branch(string $name): Branch
    {
        return Branch::firstOrCreate(['name' => $name]);
    }

    private function newStaffPayload(array $extra = []): array
    {
        return $extra + [
            'name' => 'New Keeper', 'email' => 'nk@t.test', 'password' => 'password123',
            'type' => 'staff', 'role' => 'store_keeper',
        ];
    }

    public function test_guests_and_staff_cannot_use_user_management(): void
    {
        $this->getJson('/api/v1/users')->assertStatus(401);

        $staff = $this->make('staff', 'store_keeper', 'k@t.test');
        $this->actingAs($staff, 'sanctum')->getJson('/api/v1/users')->assertStatus(403);
    }

    public function test_admin_lists_only_staff_and_super_admin_lists_everyone(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $this->make('staff', 'store_keeper', 'k1@t.test');
        $this->make('staff', 'cashier', 'k2@t.test');

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/users')->assertOk();
        $this->assertCount(2, $res->json('data'));
        $this->assertSame(['staff'], array_values(array_unique(array_column($res->json('data'), 'type'))));

        $this->actingAs($super, 'sanctum');
        $this->assertCount(4, $this->getJson('/api/v1/users')->json('data'));
        $this->assertCount(1, $this->getJson('/api/v1/users?type=admin')->json('data'));
        $this->assertCount(1, $this->getJson('/api/v1/users?role=cashier')->json('data'));
    }

    public function test_admin_creates_staff_with_branch(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $branch = $this->branch('Karachi Main');
        $admin->branches()->sync([$branch->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/users', $this->newStaffPayload(['branch_ids' => [$branch->id]]))
            ->assertCreated()
            ->assertJsonPath('data.type', 'staff')
            ->assertJsonPath('data.role', 'store_keeper');

        $this->assertSame(1, User::where('email', 'nk@t.test')->first()->branches()->count());
    }

    public function test_only_super_admin_creates_admins(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $payload = ['name' => 'Second Admin', 'email' => 'a2@t.test', 'password' => 'password123', 'type' => 'admin'];

        $this->actingAs($admin, 'sanctum')->postJson('/api/v1/users', $payload)->assertStatus(403);

        $this->actingAs($super, 'sanctum')->postJson('/api/v1/users', $payload)
            ->assertCreated()
            ->assertJsonPath('data.role', 'admin')
            ->assertJsonPath('data.twoFactorEnabled', true);
    }

    public function test_admin_cannot_assign_a_role_with_permissions_it_does_not_hold(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $role = Role::create(['key' => 'custom', 'name' => 'Custom', 'is_system' => false]);
        $role->permissions()->create(['permission_key' => 'settings.manage']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/users', $this->newStaffPayload(['role' => 'custom']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['role']);
    }

    public function test_admin_cannot_assign_a_branch_it_does_not_have(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $own = $this->branch('Karachi Main');
        $other = $this->branch('Lahore');
        $admin->branches()->sync([$own->id]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/users', $this->newStaffPayload(['branch_ids' => [$other->id]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['branch_ids']);
    }

    public function test_admin_cannot_give_staff_limits_above_its_own(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $admin->update(['discount_percent' => 5]);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/v1/users', $this->newStaffPayload(['limits' => ['discountPercent' => 10]]))
            ->assertStatus(422);

        $this->postJson('/api/v1/users', $this->newStaffPayload(['limits' => ['discountPercent' => 3]]))
            ->assertCreated()
            ->assertJsonPath('data.limits.discountPercent', 3);
    }

    public function test_admin_cannot_manage_super_admins_or_other_admins(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $otherAdmin = $this->make('admin', 'admin', 'a2@t.test');
        $super = $this->make('super_admin', 'super_admin', 's@t.test');

        $this->actingAs($admin, 'sanctum');
        $this->getJson("/api/v1/users/{$super->id}")->assertStatus(403);
        $this->getJson("/api/v1/users/{$otherAdmin->id}")->assertStatus(403);
        $this->patchJson("/api/v1/users/{$otherAdmin->id}/status", ['is_active' => false])->assertStatus(403);
    }

    public function test_disabling_a_user_revokes_tokens(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $staff = $this->make('staff', 'store_keeper', 'k@t.test');
        $staff->createToken('t');

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/users/{$staff->id}/status", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.isActive', false);

        $this->assertFalse($staff->fresh()->is_active);
        $this->assertSame(0, $staff->tokens()->count());
    }

    public function test_last_super_admin_cannot_be_disabled_through_the_api(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');

        $this->actingAs($super, 'sanctum')
            ->patchJson("/api/v1/users/{$super->id}/status", ['is_active' => false])
            ->assertStatus(422);

        $this->assertTrue($super->fresh()->is_active);
    }

    public function test_force_logout_revokes_tokens(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $staff = $this->make('staff', 'store_keeper', 'k@t.test');
        $staff->createToken('t');
        $staff->createToken('t2');

        $this->actingAs($admin, 'sanctum')->postJson("/api/v1/users/{$staff->id}/force-logout")->assertOk();

        $this->assertSame(0, $staff->tokens()->count());
    }

    public function test_reset_password_changes_the_password(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $staff = $this->make('staff', 'store_keeper', 'k@t.test');

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/v1/users/{$staff->id}/reset-password", [
                'password' => 'NewPass123!', 'password_confirmation' => 'NewPass123!',
            ])->assertOk();

        $this->assertTrue(Hash::check('NewPass123!', $staff->fresh()->password));
    }

    public function test_overrides_grant_and_deny_change_effective_permissions(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $staff = $this->make('staff', 'store_keeper', 'k@t.test');
        $resolver = app(PermissionResolver::class);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/users/{$staff->id}/overrides", ['overrides' => [
                ['key' => 'products.product.view', 'effect' => 'grant', 'expiresAt' => now()->addDays(3)->toIso8601String()],
                ['key' => 'inventory.stock.view', 'effect' => 'deny'],
            ]])->assertOk();

        $this->assertTrue($resolver->has($staff->fresh(), 'products.product.view'));
        $this->assertFalse($resolver->has($staff->fresh(), 'inventory.stock.view'));

        $this->getJson("/api/v1/users/{$staff->id}/overrides")->assertOk()->assertJsonCount(2, 'data.overrides');
    }

    public function test_admin_cannot_grant_a_permission_it_does_not_hold(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $staff = $this->make('staff', 'store_keeper', 'k@t.test');

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/v1/users/{$staff->id}/overrides", ['overrides' => [
                ['key' => 'settings.manage', 'effect' => 'grant'],
            ]])->assertStatus(422);
    }

    public function test_overrides_are_rejected_for_a_super_admin_target(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/v1/users/{$super->id}/overrides", ['overrides' => [
                ['key' => 'settings.manage', 'effect' => 'deny'],
            ]])->assertStatus(422);
    }

    public function test_unknown_permission_keys_are_rejected(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $staff = $this->make('staff', 'store_keeper', 'k@t.test');

        $this->actingAs($super, 'sanctum')
            ->putJson("/api/v1/users/{$staff->id}/overrides", ['overrides' => [
                ['key' => 'nope.nope.nope', 'effect' => 'grant'],
            ]])->assertStatus(422);
    }

    public function test_permission_registry_lists_all_keys(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');

        $res = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/permissions/registry')->assertOk();

        $this->assertCount(8, $res->json('data'));
        $this->assertContains('settings.manage', array_column($res->json('data'), 'key'));
    }

    public function test_only_super_admin_writes_roles_but_admin_can_read(): void
    {
        $admin = $this->make('admin', 'admin', 'a@t.test');
        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $body = ['name' => 'Floor Manager', 'permissions' => [['key' => 'inventory.stock.view', 'scope' => 'all']]];

        $this->actingAs($admin, 'sanctum');
        $this->getJson('/api/v1/roles')->assertOk();
        $this->postJson('/api/v1/roles', $body)->assertStatus(403);

        $this->actingAs($super, 'sanctum')->postJson('/api/v1/roles', $body)
            ->assertCreated()
            ->assertJsonPath('data.key', 'floor_manager')
            ->assertJsonCount(1, 'data.permissions');
    }

    public function test_role_clone_delete_and_protection_rules(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $this->actingAs($super, 'sanctum');

        $copy = $this->postJson('/api/v1/roles/'.Role::where('key', 'store_keeper')->value('id').'/clone', ['name' => 'Keeper Two'])
            ->assertCreated()
            ->assertJsonPath('data.key', 'keeper_two');
        $this->assertGreaterThan(0, count($copy->json('data.permissions')));
        $copyId = $copy->json('data.id');

        // system role delete nahi hota
        $this->deleteJson('/api/v1/roles/'.Role::where('key', 'store_keeper')->value('id'))->assertStatus(422);

        // super_admin role edit nahi hota
        $this->putJson('/api/v1/roles/'.Role::where('key', 'super_admin')->value('id'), ['name' => 'X'])->assertStatus(422);

        // use mein ho to delete nahi hota
        $this->make('staff', 'keeper_two', 'k@t.test');
        $this->deleteJson("/api/v1/roles/{$copyId}")->assertStatus(422);

        // use mein na ho to delete ho jata hai
        User::where('email', 'k@t.test')->update(['role' => 'cashier']);
        $this->deleteJson("/api/v1/roles/{$copyId}")->assertNoContent();
    }

    public function test_changes_are_written_to_the_audit_log(): void
    {
        $super = $this->make('super_admin', 'super_admin', 's@t.test');
        $admin = $this->make('admin', 'admin', 'a@t.test');

        $this->actingAs($super, 'sanctum')
            ->postJson('/api/v1/users', $this->newStaffPayload())
            ->assertCreated();

        $res = $this->getJson('/api/v1/audit-log')->assertOk();
        $this->assertSame('user.created', $res->json('data.0.action'));

        // Admin ko Staff par hua action dikhta hai
        $seen = $this->actingAs($admin, 'sanctum')->getJson('/api/v1/audit-log')->assertOk();
        $this->assertSame('user.created', $seen->json('data.0.action'));
    }
}