<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Location;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use App\Support\ApiQuery;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WarehouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Warehouse::query();

        if ($v = ApiQuery::param($request, 'branchId', 'branch_id')) {
            $query->where('branch_id', $v);
        }
        if ($v = ApiQuery::param($request, 'type')) {
            $query->where('type', $v);
        }
        if (in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }
        if ($v = ApiQuery::param($request, 'search')) {
            $query->where(fn ($w) => $w->where('name', 'like', "%{$v}%")->orWhere('code', 'like', "%{$v}%"));
        }
        ApiQuery::sort($query, $request, ['name' => 'name', 'code' => 'code', 'type' => 'type', 'branchId' => 'branch_id'], 'name');

        $branches = Branch::pluck('name', 'id');
        $counts = Location::selectRaw('warehouse_id, count(*) as c')->groupBy('warehouse_id')->pluck('c', 'warehouse_id');
        $page = $query->paginate(ApiQuery::perPage($request, 100));

        return response()->json(['types' => Warehouse::TYPES] + ApiQuery::page(
            $page,
            fn ($w) => $this->present($w, $branches[$w->branch_id] ?? null, (int) ($counts[$w->id] ?? 0)),
        ));
    }

    public function show(Warehouse $warehouse): JsonResponse
    {
        return response()->json(['data' => $this->presentOne($warehouse)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'branch_id' => 'required|integer|exists:branches,id',
            'name' => 'required|string|max:255',
            'code' => ['required', 'alpha_dash', 'max:20',
                Rule::unique('warehouses', 'code')->where('branch_id', $request->input('branch_id'))],
            'type' => ['required', Rule::in(Warehouse::TYPES)],
            'is_active' => 'sometimes|boolean',
        ]);

        $warehouse = Warehouse::create($data + ['is_active' => $data['is_active'] ?? true]);
        AuditLog::record($request->user(), 'warehouse.created', null, ['warehouse' => $warehouse->code]);

        return response()->json(['data' => $this->presentOne($warehouse)], 201);
    }

    public function update(Request $request, Warehouse $warehouse): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => ['sometimes', 'required', 'alpha_dash', 'max:20',
                Rule::unique('warehouses', 'code')->where('branch_id', $warehouse->branch_id)->ignore($warehouse->id)],
            'type' => ['sometimes', Rule::in(Warehouse::TYPES)],
            'is_active' => 'sometimes|boolean',
        ]);

        $warehouse->update($data);
        AuditLog::record($request->user(), 'warehouse.updated', null, ['warehouse' => $warehouse->code, 'fields' => array_keys($data)]);

        return response()->json(['data' => $this->presentOne($warehouse->fresh())]);
    }

    public function destroy(Request $request, Warehouse $warehouse): Response
    {
        if (Location::where('warehouse_id', $warehouse->id)->exists()) {
            throw ValidationException::withMessages(['warehouse' => 'This warehouse still has locations.']);
        }

        $code = $warehouse->code;
        $warehouse->delete();
        AuditLog::record($request->user(), 'warehouse.deleted', null, ['warehouse' => $code]);

        return response()->noContent();
    }

    private function presentOne(Warehouse $w): array
    {
        return $this->present(
            $w,
            Branch::where('id', $w->branch_id)->value('name'),
            Location::where('warehouse_id', $w->id)->count(),
        );
    }

    private function present(Warehouse $w, ?string $branchName, int $locationsCount): array
    {
        return [
            'id' => $w->id,
            'branchId' => $w->branch_id,
            'branchName' => $branchName,
            'name' => $w->name,
            'code' => $w->code,
            'type' => $w->type,
            'isActive' => (bool) $w->is_active,
            'locationsCount' => $locationsCount,
        ];
    }
}