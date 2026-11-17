<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Product;
use App\Services\CatalogService;
use App\Services\ProductPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function __construct(private CatalogService $catalog)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Product::query()->with(['brand', 'category'])->withCount('variants')->orderBy('name');

        if ($v = $request->query('search')) {
            $query->where(fn ($w) => $w->where('name', 'like', "%{$v}%")
                ->orWhereHas('variants', fn ($q) => $q->where('sku', 'like', "%{$v}%")->orWhere('barcode', $v)));
        }
        foreach (['brand_id', 'category_id', 'tracking_type'] as $col) {
            if ($v = $request->query($col)) {
                $query->where($col, $v);
            }
        }
        if (in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }

        $page = $query->paginate(min(max((int) $request->query('per_page', 15), 1), 100));
        $cost = ProductPresenter::canSeeCost($request->user());

        return response()->json([
            'data' => $page->getCollection()->map(fn ($p) => ProductPresenter::product($p, $cost, false))->values(),
            'meta' => [
                'page' => $page->currentPage(), 'perPage' => $page->perPage(),
                'total' => $page->total(), 'lastPage' => $page->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        return response()->json(['data' => ProductPresenter::product($product, ProductPresenter::canSeeCost($request->user()))]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(array_merge([
            'name' => 'required|string|max:255',
            'brand_id' => 'required|integer|exists:brands,id',
            'category_id' => 'nullable|integer|exists:categories,id',
            'tracking_type' => ['required', Rule::in(Product::TRACKING_TYPES)],
            'variants' => 'required|array|min:1|max:50',
        ], $this->commonRules(), CatalogService::variantRules('variants.*')));

        $actor = $request->user();
        $cost = ProductPresenter::canSeeCost($actor);

        $product = DB::transaction(function () use ($data, $actor, $cost) {
            $p = Product::create([
                'name' => $data['name'],
                'brand_id' => $data['brand_id'],
                'category_id' => $data['category_id'] ?? null,
                'tracking_type' => $data['tracking_type'],
                'description' => $data['description'] ?? null,
                'specs' => $data['specs'] ?? null,
                'warranty_months' => $data['warranty_months'] ?? 0,
                'images' => $data['images'] ?? null,
                'is_active' => $data['is_active'] ?? true,
            ]);

            foreach ($data['variants'] as $vd) {
                $this->catalog->createVariant($p, $vd, $cost, $actor);
            }
            $this->catalog->syncReorderLevels($p, $data['reorder_levels'] ?? []);
            AuditLog::record($actor, 'product.created', null, ['product' => $p->name, 'variants' => count($data['variants'])]);

            return $p;
        });

        return response()->json(['data' => ProductPresenter::product($product->fresh(), $cost)], 201);
    }

    /** tracking_type banne ke baad badalta nahi (stock aane ke baad ghalat hoga). */
    public function update(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate(array_merge([
            'name' => 'sometimes|required|string|max:255',
            'brand_id' => 'sometimes|integer|exists:brands,id',
            'category_id' => 'sometimes|nullable|integer|exists:categories,id',
        ], $this->commonRules()));

        $attrs = array_intersect_key($data, array_flip([
            'name', 'brand_id', 'category_id', 'description', 'specs', 'warranty_months', 'images', 'is_active',
        ]));

        DB::transaction(function () use ($request, $product, $attrs, $data) {
            $product->update($attrs);
            if (array_key_exists('reorder_levels', $data)) {
                $this->catalog->syncReorderLevels($product, $data['reorder_levels']);
            }
            AuditLog::record($request->user(), 'product.updated', null, ['product' => $product->name, 'fields' => array_keys($data)]);
        });

        return response()->json(['data' => ProductPresenter::product($product->fresh(), ProductPresenter::canSeeCost($request->user()))]);
    }

    public function destroy(Request $request, Product $product): Response
    {
        $name = $product->name;
        $product->delete();
        AuditLog::record($request->user(), 'product.deleted', null, ['product' => $name]);

        return response()->noContent();
    }

    private function commonRules(): array
    {
        return [
            'description' => 'sometimes|nullable|string|max:5000',
            'specs' => 'sometimes|nullable|array',
            'specs.cpu' => 'nullable|string|max:100',
            'specs.ram' => 'nullable|string|max:100',
            'specs.storage' => 'nullable|string|max:100',
            'specs.gpu' => 'nullable|string|max:100',
            'specs.screen' => 'nullable|string|max:100',
            'warranty_months' => 'sometimes|integer|min:0|max:120',
            'images' => 'sometimes|array|max:10',
            'images.*' => 'url|max:500',
            'is_active' => 'sometimes|boolean',
            'reorder_levels' => 'sometimes|array',
            'reorder_levels.*.branchId' => 'required|integer|distinct|exists:branches,id',
            'reorder_levels.*.level' => 'required|integer|min:0',
        ];
    }
}