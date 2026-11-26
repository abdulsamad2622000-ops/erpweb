<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** Angular frontend ke mock fixtures = API contract. Yeh tests usi shakal ko pakke karte hain. */
class FrontendContractUsersTest extends TestCase
{
    use RefreshDatabase;

    private User $super;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        $this->super = User::create([
            'name' => 'Boss', 'email' => 'boss@t.test', 'password' => 'password',
            'type' => 'super_admin', 'role' => 'super_admin', 'is_active' => true,
        ]);
    }

    private function staffRole(): Role
    {
        return Role::where('key', 'store_keeper')->firstOrFail();
    }

    public function test_user_list_has_total_and_frontend_fields(): void
    {
        $b = Branch::create(['name' => 'Karachi']);
        $this->super->branches()->sync([$b->id]);

        $res = $this->actingAs($this->super, 'sanctum')->getJson('/api/v1/users?page=1&pageSize=10&sort=name:asc')->assertOk();

        $res->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.branchIds', [$b->id])
            ->assertJsonPath('data.0.isActive', true)
            ->assertJsonPath('data.0.accessExpiresAt', null);
        $this->assertArrayHasKey('roleId', $res->json('data.0'));
        $this->assertArrayHasKey('roleName', $res->json('data.0'));
    }

    public function test_create_staff_with_frontend_body_sends_set_password_link(): void
    {
        Notification::fake();
        $b = Branch::create(['name' => 'Lahore']);
        $role = $this->staffRole();

        $res = $this->actingAs($this->super, 'sanctum')->postJson('/api/v1/users', [
            'name' => 'Sana', 'email' => 'Sana@T.test', 'type' => 'staff', 'roleId' => $role->id,
            'branchIds' => [$b->id], 'isActive' => true, 'accessExpiresAt' => '2027-03-31',
            'discountPercent' => 2, 'adjustmentUnits' => 3,
        ])->assertCreated();

        $res->assertJsonPath('data.email', 'sana@t.test')
            ->assertJsonPath('data.roleId', $role->id)
            ->assertJsonPath('data.roleName', $role->name)
            ->assertJsonPath('data.branchIds', [$b->id])
            ->assertJsonPath('data.accessExpiresAt', '2027-03-31')
            ->assertJsonPath('data.adjustmentUnits', 3);
        Notification::assertSentTo(User::where('email', 'sana@t.test')->first(), ResetPassword::class);

        $this->getJson('/api/v1/users?roleId='.$role->id)->assertJsonPath('total', 1);
    }

    public function test_active_toggle_delete_and_last_super_admin_guard(): void
    {
        $staff = User::create(['name' => 'K', 'email' => 'k@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'store_keeper']);
        $this->actingAs($this->super, 'sanctum');

        $this->postJson("/api/v1/users/{$staff->id}/active", ['isActive' => false])->assertOk()->assertJsonPath('data.isActive', false);
        $this->deleteJson("/api/v1/users/{$staff->id}")->assertNoContent();
        $this->assertNull(User::find($staff->id));

        // Apne aap ko delete ya aakhri Super Admin ko band nahi
        $this->assertContains($this->deleteJson("/api/v1/users/{$this->super->id}")->status(), [403, 409]);
        $this->postJson("/api/v1/users/{$this->super->id}/active", ['isActive' => false])->assertStatus(422);
    }

    public function test_expired_access_cannot_login(): void
    {
        User::create(['name' => 'Old', 'email' => 'old@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'store_keeper', 'access_expires_at' => now()->subDay()]);

        $this->postJson('/api/v1/auth/login', ['email' => 'old@t.test', 'password' => 'password'])->assertStatus(422);
    }

    public function test_admin_reset_password_sends_link_when_no_password_given(): void
    {
        Notification::fake();
        $staff = User::create(['name' => 'K', 'email' => 'k@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'store_keeper']);

        $this->actingAs($this->super, 'sanctum')->postJson("/api/v1/users/{$staff->id}/reset-password", [])->assertOk();

        Notification::assertSentTo($staff, ResetPassword::class);
    }

    public function test_roles_use_key_lists_description_and_counts(): void
    {
        $this->actingAs($this->super, 'sanctum');
        $keys = array_slice(config('permission_keys'), 0, 3);

        $created = $this->postJson('/api/v1/roles', ['name' => 'Floor Lead', 'description' => 'Shop floor', 'permissions' => $keys])->assertCreated();
        $created->assertJsonPath('data.permissions', collect($keys)->sort()->values()->all())
            ->assertJsonPath('data.permissionCount', 3)
            ->assertJsonPath('data.description', 'Shop floor')
            ->assertJsonPath('data.userCount', 0);
        $id = $created->json('data.id');

        $this->putJson("/api/v1/roles/{$id}", ['name' => 'Floor Lead', 'description' => 'Updated', 'permissions' => [$keys[0]]])
            ->assertOk()->assertJsonPath('data.permissionCount', 1);
        $this->postJson('/api/v1/roles', ['name' => 'floor lead', 'permissions' => []])->assertStatus(422);

        $list = $this->getJson('/api/v1/roles?search=floor&page=1&pageSize=10')->assertOk();
        $list->assertJsonPath('total', 1)->assertJsonPath('data.0.description', 'Updated');
    }

    public function test_user_permissions_allow_deny_round_trip(): void
    {
        $staff = User::create(['name' => 'K', 'email' => 'k@t.test', 'password' => 'password', 'type' => 'staff', 'role' => 'store_keeper']);
        $this->actingAs($this->super, 'sanctum');
        [$a, $d] = array_slice(config('permission_keys'), 0, 2);

        $this->putJson("/api/v1/users/{$staff->id}/permissions", ['allow' => [$a], 'deny' => [$d]])
            ->assertOk()->assertJsonPath('allow', [$a])->assertJsonPath('deny', [$d]);

        $res = $this->getJson("/api/v1/users/{$staff->id}/permissions")->assertOk();
        $res->assertJsonPath('userId', $staff->id)->assertJsonPath('roleName', $this->staffRole()->name);
        $this->assertIsArray($res->json('rolePermissions'));
    }

    public function test_audit_simple_list_shape(): void
    {
        AuditLog::record($this->super, 'user.created', $this->super, ['email' => 'x@t.test']);

        $res = $this->actingAs($this->super, 'sanctum')->getJson('/api/v1/audit?page=1&pageSize=10')->assertOk();

        $res->assertJsonPath('total', 1)->assertJsonPath('data.0.actor', 'Boss')->assertJsonPath('data.0.action', 'user.created');
        $this->assertStringContainsString('x@t.test', $res->json('data.0.detail'));
    }

    public function test_forgot_password_is_generic_and_reset_works(): void
    {
        config(['mail.default' => 'array']);
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'nobody@t.test'])->assertOk();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'boss@t.test'])->assertOk();
        $sent = app('mailer')->getSymfonyTransport()->messages();
        $this->assertCount(1, $sent);
        preg_match('/(\d{6})/', $sent[0]->getOriginalMessage()->getSubject(), $m);
        $code = $m[1];

        $this->postJson('/api/v1/auth/forgot-password/verify', ['email' => 'boss@t.test', 'code' => '000000'])->assertStatus(422);
        $token = $this->postJson('/api/v1/auth/forgot-password/verify', ['email' => 'boss@t.test', 'code' => $code])->assertOk()->json('token');
        $this->postJson('/api/v1/auth/forgot-password/verify', ['email' => 'boss@t.test', 'code' => $code])->assertStatus(422); // ek dafa hi

        $this->postJson('/api/v1/auth/reset-password', [
            'token' => $token, 'email' => 'boss@t.test', 'password' => 'new-password-123', 'password_confirmation' => 'new-password-123',
        ])->assertOk();
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'bad', 'email' => 'boss@t.test', 'password' => 'x12345678', 'password_confirmation' => 'x12345678',
        ])->assertStatus(422);
        $this->postJson('/api/v1/auth/recover-email', ['phone' => '0300-1234567'])->assertOk();
    }
}
