<?php

namespace App\Services;

use App\Models\Role;
use App\Models\User;

class UserPresenter
{
    /** @var array<string, Role|null> */
    private static array $roles = [];

    public static function make(User $u): array
    {
        $u->loadMissing('branches');
        $role = $u->role ? (self::$roles[$u->role] ??= Role::where('key', $u->role)->first()) : null;

        $hasLimits = $u->discount_percent !== null
            || $u->adjustment_units !== null
            || $u->max_sale_without_approval !== null;

        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'type' => $u->type,
            // Frontend contract (ManagedUser)
            'roleId' => $role?->id,
            'roleName' => $role?->name,
            'branchIds' => $u->branches->pluck('id')->map(fn ($id) => (int) $id)->values(),
            'isActive' => (bool) $u->is_active,
            'accessExpiresAt' => $u->access_expires_at?->toDateString(),
            'discountPercent' => $u->discount_percent !== null ? (float) $u->discount_percent : null,
            'adjustmentUnits' => $u->adjustment_units,
            // Purane fields (backend tests aur doosre clients)
            'role' => $u->role,
            'twoFactorEnabled' => (bool) $u->two_factor_enabled,
            'branches' => $u->branches->map(fn ($b) => ['id' => $b->id, 'name' => $b->name])->values(),
            'limits' => $hasLimits ? [
                'discountPercent' => $u->discount_percent !== null ? (float) $u->discount_percent : null,
                'adjustmentUnits' => $u->adjustment_units,
                'maxSaleWithoutApproval' => $u->max_sale_without_approval,
            ] : null,
            'createdAt' => $u->created_at?->toIso8601String(),
        ];
    }

    public static function flush(): void
    {
        self::$roles = [];
    }
}
