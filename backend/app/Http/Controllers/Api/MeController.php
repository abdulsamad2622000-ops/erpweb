<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PermissionResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeController extends Controller
{
    public function __construct(private PermissionResolver $resolver)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        $branches = $user->branches()
            ->orderBy('branches.id')
            ->get(['branches.id', 'branches.name'])
            ->map(fn ($b) => ['id' => $b->id, 'name' => $b->name])
            ->values();

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
            'permissions' => $this->resolver->for($user)->values(),
            'branches' => $branches,
            'activeBranchId' => $branches->first()['id'] ?? null,
            'limits' => $hasLimits ? [
                'discountPercent' => $user->discount_percent !== null ? (float) $user->discount_percent : null,
                'adjustmentUnits' => $user->adjustment_units,
                'maxSaleWithoutApproval' => $user->max_sale_without_approval,
            ] : null,
            'locale' => 'en',
        ]);
    }
}