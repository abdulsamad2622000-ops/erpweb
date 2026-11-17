<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $branches = $user->branches()->orderBy('branches.id')->get(['branches.id', 'branches.name']);

        $permissions = $user->permissions()
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->get()
            ->map(fn ($p) => [
                'key' => $p->permission_key,
                'scope' => $p->scope,
                'expiresAt' => $p->expires_at?->toIso8601String(),
                'limit' => $p->limit_value !== null ? (float) $p->limit_value : null,
            ])->values();

        $hasLimits = $user->discount_percent !== null
            || $user->adjustment_units !== null
            || $user->max_sale_without_approval !== null;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'role' => $user->role,
                'isSuperAdmin' => $user->type === 'super_admin',
                'type' => $user->type,
            ],
            'permissions' => $permissions,
            'branches' => $branches,
            'activeBranchId' => $branches->first()?->id,
            'limits' => $hasLimits ? [
                'discountPercent' => $user->discount_percent !== null ? (float) $user->discount_percent : null,
                'adjustmentUnits' => $user->adjustment_units,
                'maxSaleWithoutApproval' => $user->max_sale_without_approval,
            ] : null,
            'locale' => 'en',
        ]);
    }
}