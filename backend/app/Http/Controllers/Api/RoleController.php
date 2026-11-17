<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\PermissionRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RoleController extends Controller
{
    public function __construct(private PermissionRegistry $registry)
    {
    }

    public function index(): JsonResponse
    {
        $roles = Role::with('permissions')->orderBy('id')->get();

        return response()->json(['data' => $roles->map(fn ($r) => $this->present($r))->values()]);
    }

    public function show(Role $role): JsonResponse
    {
        return response()->json(['data' => $this->present($role)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => 'required|string|max:255'] + $this->permissionRules());

        $role = DB::transaction(function () use ($request, $data) {
            $role = Role::create(['key' => $this->uniqueKey($data['name']), 'name' => $data['name'], 'is_system' => false]);
            $this->syncPermissions($role, $data['permissions'] ?? []);
            AuditLog::record($request->user(), 'role.created', null, ['role' => $role->key]);

            return $role;
        });

        return response()->json(['data' => $this->present($role->fresh())], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if ($role->key === 'super_admin') {
            throw ValidationException::withMessages(['role' => 'The Super Admin role cannot be changed.']);
        }

        $data = $request->validate(['name' => 'sometimes|required|string|max:255'] + $this->permissionRules());

        DB::transaction(function () use ($request, $role, $data) {
            if (isset($data['name'])) {
                $role->update(['name' => $data['name']]);
            }
            if (array_key_exists('permissions', $data)) {
                $this->syncPermissions($role, $data['permissions']);
            }
            AuditLog::record($request->user(), 'role.updated', null, [
                'role' => $role->key, 'fields' => array_keys($data),
            ]);
        });

        return response()->json(['data' => $this->present($role->fresh())]);
    }

    public function clone(Request $request, Role $role): JsonResponse
    {
        $data = $request->validate(['name' => 'required|string|max:255']);

        $copy = DB::transaction(function () use ($request, $role, $data) {
            $copy = Role::create(['key' => $this->uniqueKey($data['name']), 'name' => $data['name'], 'is_system' => false]);
            foreach ($role->permissions as $p) {
                $copy->permissions()->create([
                    'permission_key' => $p->permission_key,
                    'scope' => $p->scope,
                    'limit_value' => $p->limit_value,
                ]);
            }
            AuditLog::record($request->user(), 'role.cloned', null, ['from' => $role->key, 'to' => $copy->key]);

            return $copy;
        });

        return response()->json(['data' => $this->present($copy->fresh())], 201);
    }

    public function destroy(Request $request, Role $role): Response
    {
        if ($role->is_system) {
            throw ValidationException::withMessages(['role' => 'System roles cannot be deleted.']);
        }

        if (User::where('role', $role->key)->exists()) {
            throw ValidationException::withMessages(['role' => 'This role is still assigned to users.']);
        }

        $key = $role->key;
        $role->delete();
        AuditLog::record($request->user(), 'role.deleted', null, ['role' => $key]);

        return response()->noContent();
    }

    private function permissionRules(): array
    {
        return [
            'permissions' => 'sometimes|array',
            'permissions.*.key' => ['required', 'string', 'distinct', Rule::in($this->registry->keys())],
            'permissions.*.scope' => 'nullable|string|max:20',
            'permissions.*.limit' => 'nullable|numeric|min:0',
        ];
    }

    private function syncPermissions(Role $role, array $permissions): void
    {
        $role->permissions()->delete();
        foreach ($permissions as $p) {
            $role->permissions()->create([
                'permission_key' => $p['key'],
                'scope' => $p['scope'] ?? 'all',
                'limit_value' => $p['limit'] ?? null,
            ]);
        }
    }

    private function uniqueKey(string $name): string
    {
        $base = Str::slug($name, '_') ?: 'role';
        $key = $base;
        $i = 2;
        while (Role::where('key', $key)->exists()) {
            $key = $base.'_'.$i++;
        }

        return $key;
    }

    private function present(Role $role): array
    {
        $role->loadMissing('permissions');

        return [
            'id' => $role->id,
            'key' => $role->key,
            'name' => $role->name,
            'isSystem' => (bool) $role->is_system,
            'usersCount' => User::where('role', $role->key)->count(),
            'permissions' => $role->permissions->map(fn ($p) => [
                'key' => $p->permission_key,
                'scope' => $p->scope,
                'limit' => $p->limit_value !== null ? (float) $p->limit_value : null,
            ])->sortBy('key')->values(),
        ];
    }
}