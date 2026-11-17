<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Location;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LocationController extends Controller
{
    /** Parent ka level -> naye child ka level. '' = koi parent nahi. */
    private const NEXT_LEVEL = ['' => 'zone', 'zone' => 'rack', 'rack' => 'shelf', 'shelf' => 'bin'];

    public function tree(Warehouse $warehouse): JsonResponse
    {
        $by = Location::where('warehouse_id', $warehouse->id)->orderBy('code')->get()
            ->groupBy(fn ($l) => $l->parent_id ?? 0);

        $build = function ($parentId, string $prefix) use (&$build, $by) {
            return ($by[$parentId] ?? collect())->map(function ($l) use (&$build, $prefix) {
                $path = $prefix.'/'.$l->code;

                return $this->present($l, $path) + ['children' => $build($l->id, $path)];
            })->values()->all();
        };

        return response()->json(['data' => $build(0, $warehouse->code)]);
    }

    public function lookup(Request $request): JsonResponse
    {
        $barcode = $request->validate(['barcode' => 'required|string'])['barcode'];
        $location = Location::where('barcode', $barcode)->firstOrFail();

        return response()->json(['data' => $this->present($location, $this->pathOf($location))]);
    }

    public function store(Request $request, Warehouse $warehouse): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => 'nullable|integer|exists:locations,id',
            'name' => 'required|string|max:255',
            'code' => 'required|alpha_dash|max:30',
        ]);

        $parent = isset($data['parent_id']) ? Location::findOrFail($data['parent_id']) : null;

        if ($parent && (int) $parent->warehouse_id !== (int) $warehouse->id) {
            throw ValidationException::withMessages(['parent_id' => 'The parent belongs to another warehouse.']);
        }

        $level = self::NEXT_LEVEL[$parent?->level ?? ''] ?? null;
        if ($level === null) {
            throw ValidationException::withMessages(['parent_id' => 'A bin cannot contain other locations.']);
        }

        $this->assertSiblingCodeFree($warehouse->id, $parent?->id, $data['code']);

        $location = Location::create([
            'warehouse_id' => $warehouse->id,
            'parent_id' => $parent?->id,
            'level' => $level,
            'name' => $data['name'],
            'code' => $data['code'],
            'is_active' => true,
        ]);

        if ($level === 'bin') {
            $location->update(['barcode' => 'BIN-'.str_pad((string) $location->id, 6, '0', STR_PAD_LEFT)]);
        }

        AuditLog::record($request->user(), 'location.created', null, ['level' => $level, 'code' => $location->code]);

        return response()->json(['data' => $this->present($location->fresh(), $this->pathOf($location))], 201);
    }

    public function update(Request $request, Location $location): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'code' => 'sometimes|required|alpha_dash|max:30',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($data['code']) && $data['code'] !== $location->code) {
            $this->assertSiblingCodeFree($location->warehouse_id, $location->parent_id, $data['code'], $location->id);
        }

        $location->update($data);
        AuditLog::record($request->user(), 'location.updated', null, ['code' => $location->code, 'fields' => array_keys($data)]);

        return response()->json(['data' => $this->present($location->fresh(), $this->pathOf($location->fresh()))]);
    }

    public function destroy(Request $request, Location $location): Response
    {
        if (Location::where('parent_id', $location->id)->exists()) {
            throw ValidationException::withMessages(['location' => 'This location still has children.']);
        }

        $code = $location->code;
        $location->delete();
        AuditLog::record($request->user(), 'location.deleted', null, ['code' => $code]);

        return response()->noContent();
    }

    private function assertSiblingCodeFree(int $warehouseId, ?int $parentId, string $code, ?int $ignoreId = null): void
    {
        $exists = Location::where('warehouse_id', $warehouseId)
            ->where('parent_id', $parentId)
            ->where('code', $code)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages(['code' => 'This code is already used at this level.']);
        }
    }

    private function pathOf(Location $l): string
    {
        $codes = [$l->code];
        $p = $l;
        while ($p->parent_id) {
            $p = Location::find($p->parent_id);
            array_unshift($codes, $p->code);
        }

        return Warehouse::where('id', $l->warehouse_id)->value('code').'/'.implode('/', $codes);
    }

    private function present(Location $l, string $path): array
    {
        return [
            'id' => $l->id,
            'warehouseId' => $l->warehouse_id,
            'parentId' => $l->parent_id,
            'level' => $l->level,
            'name' => $l->name,
            'code' => $l->code,
            'barcode' => $l->barcode,
            'path' => $path,
            'isActive' => (bool) $l->is_active,
        ];
    }
}