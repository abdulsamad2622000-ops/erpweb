<?php

namespace App\Services;

use App\Models\User;

class UserPresenter
{
    public static function make(User $u): array
    {
        $u->loadMissing('branches');

        $hasLimits = $u->discount_percent !== null
            || $u->adjustment_units !== null
            || $u->max_sale_without_approval !== null;

        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'type' => $u->type,
            'role' => $u->role,
            'isActive' => (bool) $u->is_active,
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
}