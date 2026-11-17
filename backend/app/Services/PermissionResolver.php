<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;

class PermissionResolver
{
    /**
     * Effective permissions = role + user grants - user denies.
     * Expired user rows ignore hote hain. Super Admin par deny lagu nahi hota.
     *
     * @return Collection<int, array{key:string,scope:string,expiresAt:?string,limit:?float}>
     */
    public function for(User $user): Collection
    {
        $map = [];

        if ($user->role) {
            $role = Role::where('key', $user->role)->first();
            foreach ($role?->permissions ?? [] as $p) {
                $map[$p->permission_key] = [
                    'key' => $p->permission_key,
                    'scope' => $p->scope,
                    'expiresAt' => null,
                    'limit' => $p->limit_value !== null ? (float) $p->limit_value : null,
                ];
            }
        }

        $overrides = $user->permissions()
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->get();

        foreach ($overrides as $o) {
            if ($o->effect === 'deny') {
                if ($user->type !== 'super_admin') {
                    unset($map[$o->permission_key]);
                }
                continue;
            }

            $map[$o->permission_key] = [
                'key' => $o->permission_key,
                'scope' => $o->scope,
                'expiresAt' => $o->expires_at?->toIso8601String(),
                'limit' => $o->limit_value !== null ? (float) $o->limit_value : null,
            ];
        }

        return collect($map)->sortKeys()->values();
    }

    public function has(User $user, string $key): bool
    {
        return $this->for($user)->contains('key', $key);
    }
}