<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if ($request->header('X-Client') === 'erp-web') {
            return app(ProductScreenController::class)->categories($request);
        }

        $all = Category::orderBy('name')->get()->groupBy(fn ($c) => $c->parent_id ?? 0);

        $build = function ($parentId) use (&$build, $all) {
            return ($all[$parentId] ?? collect())
                ->map(fn ($c) => $this->present($c) + ['children' => $build($c->id)])
                ->values()->all();
        };

        return response()->json(['data' => $build(0)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'parent_id' => 'nullable|integer|exists:categories,id',
        ]);

        $this->assertNameFree($data['name'], $data['parent_id'] ?? null);

        $category = Category::create([
            'name' => $data['name'], 'parent_id' => $data['parent_id'] ?? null, 'is_active' => true,
        ]);
        AuditLog::record($request->user(), 'category.created', null, ['category' => $category->name]);

        return response()->json(['data' => $this->present($category)], 201);
    }

    public function update(Request $request, Category $category): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'parent_id' => 'sometimes|nullable|integer|exists:categories,id',
            'is_active' => 'sometimes|boolean',
        ]);

        if (array_key_exists('parent_id', $data) && $data['parent_id']) {
            $p = (int) $data['parent_id'];
            while ($p) {
                if ($p === $category->id) {
                    throw ValidationException::withMessages(['parent_id' => 'A category cannot be placed under itself.']);
                }
                $p = (int) Category::where('id', $p)->value('parent_id');
            }
        }

        $name = $data['name'] ?? $category->name;
        $parent = array_key_exists('parent_id', $data) ? $data['parent_id'] : $category->parent_id;
        if (isset($data['name']) || array_key_exists('parent_id', $data)) {
            $this->assertNameFree($name, $parent, $category->id);
        }

        $category->update($data);
        AuditLog::record($request->user(), 'category.updated', null, ['category' => $category->name]);

        return response()->json(['data' => $this->present($category->fresh())]);
    }

    public function destroy(Request $request, Category $category): Response
    {
        if (Category::where('parent_id', $category->id)->exists()) {
            throw ValidationException::withMessages(['category' => 'This category still has sub-categories.']);
        }
        if (Product::where('category_id', $category->id)->exists()) {
            throw ValidationException::withMessages(['category' => 'This category still has products.']);
        }

        $name = $category->name;
        $category->delete();
        AuditLog::record($request->user(), 'category.deleted', null, ['category' => $name]);

        return response()->noContent();
    }

    private function assertNameFree(string $name, ?int $parentId, ?int $ignoreId = null): void
    {
        $exists = Category::where('parent_id', $parentId)->where('name', $name)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))->exists();

        if ($exists) {
            throw ValidationException::withMessages(['name' => 'This name is already used at this level.']);
        }
    }

    private function present(Category $c): array
    {
        return [
            'id' => $c->id,
            'parentId' => $c->parent_id,
            'name' => $c->name,
            'isActive' => (bool) $c->is_active,
            'productsCount' => Product::where('category_id', $c->id)->count(),
        ];
    }
}