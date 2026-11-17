<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class UserAccessRules
{
    private const LIMITS = [
        'discountPercent' => 'discount_percent',
        'adjustmentUnits' => 'adjustment_units',
        'maxSaleWithoutApproval' => 'max_sale_without_approval',
    ];

    private const RESERVED_ROLES = ['super_admin', 'admin'];

    public function __construct(private GrantPolicy $policy)
    {
    }

    /** Final role key nikalta hai aur check karta hai ke actor ye role de sakta hai. */
    public function roleFor(User $actor, string $type, ?string $roleKey): string
    {
        if ($type !== 'staff') {
            return $type; // admin -> 'admin', super_admin -> 'super_admin'
        }

        if (! $roleKey) {
            throw ValidationException::withMessages(['role' => 'A role is required for Staff.']);
        }

        if (in_array($roleKey, self::RESERVED_ROLES, true)) {
            throw ValidationException::withMessages(['role' => 'Staff cannot use this role.']);
        }

        $role = Role::with('permissions')->where('key', $roleKey)->firstOrFail();

        if ($actor->type !== 'super_admin') {
            foreach ($role->permissions as $p) {
                $limit = $p->limit_value !== null ? (float) $p->limit_value : null;
                if (! $this->policy->canGrant($actor, $p->permission_key, $p->scope, $limit)) {
                    throw ValidationException::withMessages([
                        'role' => "You cannot assign this role: you do not hold {$p->permission_key}.",
                    ]);
                }
            }
        }

        return $role->key;
    }

    /** @param list<int> $ids */
    public function assertBranches(User $actor, array $ids): void
    {
        if ($actor->type === 'super_admin') {
            return;
        }

        $own = $actor->branches()->pluck('branches.id')->map(fn ($i) => (int) $i)->all();

        if (array_diff($ids, $own)) {
            throw ValidationException::withMessages(['branch_ids' => 'You can only assign your own branches.']);
        }
    }

    /** limits payload (camelCase) se DB columns. null = sab limits null. */
    public function columns(?array $limits): array
    {
        $out = [];
        foreach (self::LIMITS as $name => $col) {
            if ($limits === null) {
                $out[$col] = null;
            } elseif (array_key_exists($name, $limits)) {
                $out[$col] = $limits[$name];
            }
        }

        return $out;
    }

    /** Admin ne limits nahi bheji to Staff ko Admin ki apni limits milti hain. */
    public function inherit(User $actor): array
    {
        if ($actor->type === 'super_admin') {
            return [];
        }

        $out = [];
        foreach (self::LIMITS as $col) {
            $out[$col] = $actor->{$col};
        }

        return $out;
    }

    public function assertLimits(User $actor, array $columns): void
    {
        if ($actor->type === 'super_admin') {
            return;
        }

        foreach ($columns as $col => $value) {
            $mine = $actor->{$col};
            if ($mine !== null && ($value === null || (float) $value > (float) $mine)) {
                $name = array_search($col, self::LIMITS, true);
                throw ValidationException::withMessages(["limits.$name" => 'This exceeds your own limit.']);
            }
        }
    }
}