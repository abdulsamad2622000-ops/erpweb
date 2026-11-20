<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BrandController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->header('X-Client') === 'erp-web') {
            return app(ProductScreenController::class)->brands($request);
        }

        $counts = Product::selectRaw('brand_id, count(*) as c')->groupBy('brand_id')->pluck('c', 'brand_id');

        return response()->json([
            'data' => Brand::orderBy('name')->get()
                ->map(fn ($b) => $this->present($b, (int) ($counts[$b->id] ?? 0)))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:100|unique:brands,name',
            'is_active' => 'sometimes|boolean',
        ]);

        $brand = Brand::create($data + ['is_active' => true]);
        AuditLog::record($request->user(), 'brand.created', null, ['brand' => $brand->name]);

        return response()->json(['data' => $this->present($brand, 0)], 201);
    }

    public function update(Request $request, Brand $brand): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100', Rule::unique('brands', 'name')->ignore($brand->id)],
            'is_active' => 'sometimes|boolean',
        ]);

        $brand->update($data);
        AuditLog::record($request->user(), 'brand.updated', null, ['brand' => $brand->name]);

        return response()->json(['data' => $this->present($brand->fresh(), Product::where('brand_id', $brand->id)->count())]);
    }

    public function destroy(Request $request, Brand $brand): Response
    {
        if (Product::where('brand_id', $brand->id)->exists()) {
            throw ValidationException::withMessages(['brand' => 'This brand still has products.']);
        }

        $name = $brand->name;
        $brand->delete();
        AuditLog::record($request->user(), 'brand.deleted', null, ['brand' => $name]);

        return response()->noContent();
    }

    private function present(Brand $b, int $productsCount): array
    {
        return ['id' => $b->id, 'name' => $b->name, 'isActive' => (bool) $b->is_active, 'productsCount' => $productsCount];
    }
}