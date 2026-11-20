<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use App\Support\ApiQuery;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BranchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Branch::query();
        if (in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }
        if ($v = ApiQuery::param($request, 'search')) {
            $query->where(fn ($w) => $w->where('name', 'like', "%{$v}%")->orWhere('code', 'like', "%{$v}%")->orWhere('city', 'like', "%{$v}%"));
        }
        ApiQuery::sort($query, $request, ['name' => 'name', 'code' => 'code', 'city' => 'city'], 'name');
        $counts = Warehouse::selectRaw('branch_id, count(*) as c')->groupBy('branch_id')->pluck('c', 'branch_id');
        $page = $query->paginate(ApiQuery::perPage($request, 100));

        return response()->json(ApiQuery::page($page, fn ($b) => $this->present($b, (int) ($counts[$b->id] ?? 0))));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255|unique:branches,name',
            'code' => 'nullable|alpha_dash|max:20|unique:branches,code',
            'city' => 'nullable|string|max:100',
            'address' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
        ]);

        $branch = new Branch();
        $branch->forceFill([
            'name' => $data['name'],
            'code' => $data['code'] ?? null,
            'city' => $data['city'] ?? null,
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ])->save();

        AuditLog::record($request->user(), 'branch.created', null, ['branch' => $branch->name]);

        return response()->json(['data' => $this->present($branch, 0)], 201);
    }

    public function update(Request $request, Branch $branch): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('branches', 'name')->ignore($branch->id)],
            'code' => ['sometimes', 'nullable', 'alpha_dash', 'max:20', Rule::unique('branches', 'code')->ignore($branch->id)],
            'city' => 'sometimes|nullable|string|max:100',
            'address' => 'sometimes|nullable|string|max:500',
            'phone' => 'sometimes|nullable|string|max:50',
            'is_active' => 'sometimes|boolean',
        ]);

        $branch->forceFill($data)->save();
        AuditLog::record($request->user(), 'branch.updated', null, ['branch' => $branch->name, 'fields' => array_keys($data)]);

        return response()->json([
            'data' => $this->present($branch->fresh(), Warehouse::where('branch_id', $branch->id)->count()),
        ]);
    }

    public function destroy(Request $request, Branch $branch): Response
    {
        if (Warehouse::where('branch_id', $branch->id)->exists()) {
            throw ValidationException::withMessages(['branch' => 'This branch still has warehouses.']);
        }

        if (User::whereHas('branches', fn ($q) => $q->where('branches.id', $branch->id))->exists()) {
            throw ValidationException::withMessages(['branch' => 'This branch is still assigned to users.']);
        }

        $name = $branch->name;
        $branch->delete();
        AuditLog::record($request->user(), 'branch.deleted', null, ['branch' => $name]);

        return response()->noContent();
    }

    private function present(Branch $b, int $warehousesCount): array
    {
        return [
            'id' => $b->id,
            'name' => $b->name,
            'code' => (string) $b->code,
            'city' => (string) $b->city,
            'address' => (string) $b->address,
            'phone' => (string) $b->phone,
            'isActive' => (bool) $b->is_active,
            'warehousesCount' => $warehousesCount,
        ];
    }
}