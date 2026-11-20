<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\GrantPolicy;
use App\Services\PermissionRegistry;
use App\Services\PermissionResolver;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserPermissionController extends Controller
{
    public function __construct(
        private GrantPolicy $policy,
        private PermissionResolver $resolver,
        private PermissionRegistry $registry,
    ) {
    }

    public function show(Request $request, User $user): JsonResponse
    {
        abort_unless($this->policy->canManage($request->user(), $user), 403, 'You cannot manage this user.');

        return response()->json($this->payload($user));
    }

    /** Is user ke saare overrides ek saath replace hote hain. */
    public function update(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        abort_unless($this->policy->canManage($actor, $user), 403, 'You cannot manage this user.');

        if ($user->type === 'super_admin') {
            throw ValidationException::withMessages([
                'overrides' => 'A Super Admin always has every permission.',
            ]);
        }

        $data = $request->validate([
            'overrides' => 'present|array',
            'overrides.*.key' => ['required', 'string', 'distinct', Rule::in($this->registry->keys())],
            'overrides.*.effect' => 'required|in:grant,deny',
            'overrides.*.scope' => 'nullable|string|max:20',
            'overrides.*.limit' => 'nullable|numeric|min:0',
            'overrides.*.expiresAt' => 'nullable|date|after:now',
        ]);

        $rows = [];
        foreach ($data['overrides'] as $i => $o) {
            $scope = $o['scope'] ?? 'all';
            $limit = isset($o['limit']) ? (float) $o['limit'] : null;
            $expires = ! empty($o['expiresAt']) ? Carbon::parse($o['expiresAt']) : null;

            if ($o['effect'] === 'grant' && ! $this->policy->canGrant($actor, $o['key'], $scope, $limit, $expires)) {
                throw ValidationException::withMessages([
                    "overrides.$i.key" => "You cannot grant {$o['key']} with these settings.",
                ]);
            }

            $rows[] = [
                'permission_key' => $o['key'],
                'effect' => $o['effect'],
                'scope' => $scope,
                'limit_value' => $limit,
                'expires_at' => $expires,
            ];
        }

        DB::transaction(function () use ($actor, $user, $rows) {
            $user->permissions()->delete();
            foreach ($rows as $row) {
                $user->permissions()->create($row);
            }
            AuditLog::record($actor, 'user.overrides_updated', $user, [
                'overrides' => array_map(fn ($r) => [
                    'key' => $r['permission_key'],
                    'effect' => $r['effect'],
                    'scope' => $r['scope'],
                    'limit' => $r['limit_value'],
                    'expiresAt' => $r['expires_at']?->toIso8601String(),
                ], $rows),
            ]);
        });

        return response()->json($this->payload($user->fresh()));
    }

    /** GET /users/{user}/permissions (frontend contract): role ki permissions + allow/deny lists */
    public function showSimple(Request $request, User $user): JsonResponse
    {
        abort_unless($this->policy->canManage($request->user(), $user), 403, 'You cannot manage this user.');

        return response()->json($this->simple($user));
    }

    /** PUT /users/{user}/permissions { allow: [], deny: [] } -> overrides (grant/deny) */
    public function updateSimple(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'allow' => 'present|array',
            'allow.*' => 'string',
            'deny' => 'present|array',
            'deny.*' => 'string',
        ]);
        $overrides = array_merge(
            array_map(fn ($k) => ['key' => $k, 'effect' => 'grant'], array_values(array_unique($data['allow']))),
            array_map(fn ($k) => ['key' => $k, 'effect' => 'deny'], array_values(array_diff(array_unique($data['deny']), $data['allow']))),
        );
        $request->replace(['overrides' => $overrides]);
        $this->update($request, $user);

        return response()->json($this->simple($user->fresh()));
    }

    private function simple(User $user): array
    {
        $role = $user->role ? Role::with('permissions')->where('key', $user->role)->first() : null;
        $rows = $user->permissions()->orderBy('permission_key')->get();

        return [
            'userId' => $user->id,
            'userName' => $user->name,
            'roleName' => $role?->name,
            'rolePermissions' => $role ? $role->permissions->pluck('permission_key')->sort()->values() : [],
            'allow' => $rows->where('effect', 'grant')->pluck('permission_key')->values(),
            'deny' => $rows->where('effect', 'deny')->pluck('permission_key')->values(),
        ];
    }

    private function payload(User $user): array
    {
        return ['data' => [
            'role' => $user->role,
            'effective' => $this->resolver->for($user)->values(),
            'overrides' => $user->permissions()->orderBy('permission_key')->get()->map(fn ($o) => [
                'key' => $o->permission_key,
                'effect' => $o->effect,
                'scope' => $o->scope,
                'limit' => $o->limit_value !== null ? (float) $o->limit_value : null,
                'expiresAt' => $o->expires_at?->toIso8601String(),
                'expired' => $o->expires_at !== null && $o->expires_at->isPast(),
            ])->values(),
        ]];
    }
}