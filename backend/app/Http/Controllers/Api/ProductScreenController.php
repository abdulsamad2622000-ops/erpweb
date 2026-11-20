<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Category;
use App\Models\PriceHistory;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\CatalogService;
use App\Services\PriceService;
use App\Services\ProductPresenter;
use App\Support\ApiQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Angular frontend ka products contract (X-Client: erp-web header par).
 * Backend mein product ke variants hote hain; frontend mein:
 *   product.sku / barcode / costPrice / prices / minPrice = pehla ("main") variant
 *   product.variants = baqi variants (sirf sku, name, barcode, isActive)
 */
class ProductScreenController extends Controller
{
    public function __construct(private CatalogService $catalog, private PriceService $prices)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Product::query()->with(['variants.prices.tier']);
        if ($v = ApiQuery::param($request, 'search')) {
            $query->where(fn ($w) => $w->where('name', 'like', "%{$v}%")
                ->orWhereHas('variants', fn ($q) => $q->where('sku', 'like', "%{$v}%")->orWhere('barcode', $v)));
        }
        if ($v = ApiQuery::param($request, 'brandId')) {
            $query->where('brand_id', $v);
        }
        if ($v = ApiQuery::param($request, 'categoryId')) {
            $query->where('category_id', $v);
        }
        if (in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }
        ApiQuery::sort($query, $request, ['name' => 'name', 'isActive' => 'is_active'], 'name');
        $cost = ProductPresenter::canSeeCost($request->user());
        $page = $query->paginate(ApiQuery::perPage($request, 10));

        return response()->json(ApiQuery::page($page, fn ($p) => $this->present($p, $cost)));
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        return response()->json($this->present($product, ProductPresenter::canSeeCost($request->user())));
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate($this->rules());
        $actor = $request->user();
        $cost = ProductPresenter::canSeeCost($actor);
        $this->assertSkus($d);

        $product = DB::transaction(function () use ($d, $actor, $cost) {
            $p = Product::create($this->productAttrs($d) + ['tracking_type' => $d['trackBatch'] ? 'batch' : 'serialized']);
            $this->catalog->createVariant($p, $this->mainVariant($d), $cost, $actor);
            foreach ($d['variants'] ?? [] as $v) {
                $this->catalog->createVariant($p, $this->extraVariant($v), $cost, $actor);
            }
            $this->catalog->syncReorderLevels($p, $d['reorderLevels'] ?? []);
            AuditLog::record($actor, 'product.created', null, ['product' => $p->name, 'sku' => $d['sku']]);

            return $p;
        });

        return response()->json($this->present($product->fresh(), $cost), 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $d = $request->validate($this->rules($product));
        $actor = $request->user();
        $cost = ProductPresenter::canSeeCost($actor);
        $this->assertSkus($d, $product);
        if (($d['trackBatch'] ? 'batch' : 'serialized') !== $product->tracking_type) {
            throw ValidationException::withMessages(['trackBatch' => 'The tracking type cannot be changed after creation.']);
        }

        DB::transaction(function () use ($d, $actor, $cost, $product) {
            $product->update($this->productAttrs($d));
            $variants = $product->variants()->orderBy('id')->get();
            $main = $variants->first();
            $mainData = $this->mainVariant($d);
            $main->update(['sku' => $mainData['sku'], 'barcode' => $mainData['barcode'], 'is_active' => true]
                + ($cost ? ['cost_price' => $mainData['cost_price']] : []));
            $this->prices->sync($main, $mainData['prices'], $actor);

            $keep = [];
            foreach ($d['variants'] ?? [] as $v) {
                $row = isset($v['id']) ? $variants->firstWhere('id', $v['id']) : null;
                if ($row && $row->id !== $main->id) {
                    $row->update(['sku' => $v['sku'], 'name' => $v['name'] ?? null, 'barcode' => $v['barcode'] ?? null, 'is_active' => $v['isActive'] ?? true]);
                    $keep[] = $row->id;
                } else {
                    $keep[] = $this->catalog->createVariant($product, $this->extraVariant($v), $cost, $actor)->id;
                }
            }
            $variants->slice(1)->whereNotIn('id', $keep)->each->delete();
            $this->catalog->syncReorderLevels($product, $d['reorderLevels'] ?? []);
            AuditLog::record($actor, 'product.updated', null, ['product' => $product->name]);
        });

        return response()->json($this->present($product->fresh(), $cost));
    }

    /** GET /products/{product}/history: main variant ki price history, naya pehle */
    public function history(Product $product): JsonResponse
    {
        $main = $product->variants()->orderBy('id')->first();
        $tiers = PriceTier::pluck('key', 'id');
        $rows = $main ? PriceHistory::where('variant_id', $main->id)->orderByDesc('id')->limit(200)->get() : collect();
        $users = User::whereIn('id', $rows->pluck('changed_by')->filter())->pluck('name', 'id');

        return response()->json($rows->map(fn ($h) => [
            'id' => $h->id,
            'productId' => $product->id,
            'tier' => $tiers[$h->price_tier_id] ?? null,
            'oldPrice' => $h->old_price !== null ? (float) $h->old_price : null,
            'newPrice' => (float) $h->new_price,
            'changedAt' => $h->created_at?->toIso8601String(),
            'changedBy' => $users[$h->changed_by] ?? 'System',
        ])->values());
    }

    public function brands(Request $request): JsonResponse
    {
        $query = Brand::query();
        if ($v = ApiQuery::param($request, 'search')) {
            $query->where('name', 'like', "%{$v}%");
        }
        if (in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }
        ApiQuery::sort($query, $request, ['name' => 'name', 'isActive' => 'is_active'], 'name');

        return response()->json(ApiQuery::page($query->paginate(ApiQuery::perPage($request, 100)),
            fn ($b) => ['id' => $b->id, 'name' => $b->name, 'isActive' => (bool) $b->is_active]));
    }

    public function categories(Request $request): JsonResponse
    {
        $query = Category::query();
        if ($v = ApiQuery::param($request, 'search')) {
            $query->where('name', 'like', "%{$v}%");
        }
        if ($v = ApiQuery::param($request, 'parentId')) {
            $query->where('parent_id', $v);
        }
        ApiQuery::sort($query, $request, ['name' => 'name', 'isActive' => 'is_active'], 'name');

        return response()->json(ApiQuery::page($query->paginate(ApiQuery::perPage($request, 500)),
            fn ($c) => ['id' => $c->id, 'name' => $c->name, 'parentId' => $c->parent_id, 'isActive' => (bool) $c->is_active]));
    }

    private function rules(?Product $product = null): array
    {
        return [
            'sku' => 'required|string|max:64',
            'name' => 'required|string|max:255',
            'barcode' => 'nullable|string|max:64',
            'brandId' => 'required|integer|exists:brands,id',
            'categoryId' => 'nullable|integer|exists:categories,id',
            'trackBatch' => 'required|boolean',
            'specs' => 'nullable|array',
            'specs.*' => 'nullable|string|max:100',
            'warrantyMonths' => 'nullable|integer|min:0|max:120',
            'costPrice' => 'nullable|numeric|min:0',
            'minPrice' => 'nullable|numeric|min:0',
            'prices' => 'nullable|array',
            'prices.*.tier' => ['required', 'string', Rule::exists('price_tiers', 'key')],
            'prices.*.price' => 'required|numeric|min:0',
            'reorderLevels' => 'nullable|array',
            'reorderLevels.*.branchId' => 'required|integer|distinct|exists:branches,id',
            'reorderLevels.*.level' => 'required|integer|min:0',
            'variants' => 'nullable|array|max:50',
            'variants.*.id' => 'nullable|integer',
            'variants.*.sku' => 'required|string|max:64',
            'variants.*.name' => 'nullable|string|max:255',
            'variants.*.barcode' => 'nullable|string|max:64',
            'variants.*.isActive' => 'nullable|boolean',
            'images' => 'nullable|array|max:10',
            'images.*.url' => ['required', 'string', 'max:2000000', 'regex:#^(https?://|data:image/(png|jpeg|webp);base64,)#'],
            'images.*.name' => 'nullable|string|max:255',
            'images.*.isPrimary' => 'nullable|boolean',
            'isActive' => 'required|boolean',
        ];
    }

    /** Saare SKUs/barcodes (main + variants) aapas mein aur doosre products se alag hon. */
    private function assertSkus(array $d, ?Product $product = null): void
    {
        $skus = array_merge([$d['sku']], array_column($d['variants'] ?? [], 'sku'));
        $lower = array_map('mb_strtolower', $skus);
        if (count($lower) !== count(array_unique($lower))) {
            throw ValidationException::withMessages(['sku' => 'Each SKU must be different.']);
        }
        $ids = $product ? $product->variants()->pluck('id') : collect();
        $taken = ProductVariant::whereIn('sku', $skus)->whereNotIn('id', $ids)->pluck('sku');
        if ($taken->isNotEmpty()) {
            throw ValidationException::withMessages(['sku' => 'This SKU is already used: '.$taken->first()]);
        }
        $barcodes = array_values(array_filter(array_merge([$d['barcode'] ?? null], array_column($d['variants'] ?? [], 'barcode'))));
        if ($barcodes && ProductVariant::whereIn('barcode', $barcodes)->whereNotIn('id', $ids)->exists()) {
            throw ValidationException::withMessages(['barcode' => 'This barcode is already used by another product.']);
        }
    }

    private function productAttrs(array $d): array
    {
        $images = array_map(fn ($i) => ['url' => $i['url'], 'name' => $i['name'] ?? '', 'isPrimary' => (bool) ($i['isPrimary'] ?? false)], $d['images'] ?? []);

        return [
            'name' => trim($d['name']),
            'brand_id' => $d['brandId'],
            'category_id' => $d['categoryId'] ?? null,
            'specs' => $d['specs'] ?? null,
            'warranty_months' => $d['warrantyMonths'] ?? 0,
            'images' => $images ?: null,
            'is_active' => $d['isActive'],
        ];
    }

    private function mainVariant(array $d): array
    {
        $min = isset($d['minPrice']) ? (float) $d['minPrice'] : null;
        $prices = array_map(fn ($p) => [
            'tier' => $p['tier'],
            'price' => (float) $p['price'],
            // Minimum price retail tier par lagti hai (frontend mein ek hi min price hai)
            'minPrice' => $p['tier'] === 'retail' ? $min : null,
        ], $d['prices'] ?? []);

        return [
            'sku' => $d['sku'], 'name' => null, 'barcode' => $d['barcode'] ?? null,
            'cost_price' => $d['costPrice'] ?? null, 'is_active' => true, 'prices' => $prices,
        ];
    }

    private function extraVariant(array $v): array
    {
        return ['sku' => $v['sku'], 'name' => $v['name'] ?? null, 'barcode' => $v['barcode'] ?? null, 'is_active' => $v['isActive'] ?? true, 'prices' => []];
    }

    private function present(Product $p, bool $cost): array
    {
        $p->loadMissing('variants.prices.tier');
        $variants = $p->variants->sortBy('id')->values();
        $main = $variants->first();
        $retail = $main?->prices->first(fn ($x) => $x->tier?->key === 'retail');
        $levels = DB::table('product_reorder_levels')->where('product_id', $p->id)->orderBy('branch_id')->get();

        $out = [
            'id' => $p->id,
            'sku' => (string) $main?->sku,
            'name' => $p->name,
            'barcode' => $main?->barcode,
            'brandId' => $p->brand_id,
            'categoryId' => $p->category_id,
            'trackBatch' => $p->tracking_type === 'batch',
            'specs' => array_merge(['cpu' => '', 'ram' => '', 'storage' => '', 'gpu' => '', 'screen' => ''], $p->specs ?? []),
            'warrantyMonths' => (int) $p->warranty_months,
            'minPrice' => $retail?->min_price !== null ? (float) $retail->min_price : null,
            'prices' => $main ? $main->prices->map(fn ($x) => ['tier' => $x->tier?->key, 'price' => (float) $x->price])->values() : [],
            'reorderLevels' => $levels->map(fn ($r) => ['branchId' => (int) $r->branch_id, 'level' => (int) $r->level])->values(),
            'variants' => $variants->slice(1)->map(fn ($v) => [
                'id' => $v->id, 'sku' => $v->sku, 'name' => (string) $v->name, 'barcode' => $v->barcode, 'isActive' => (bool) $v->is_active,
            ])->values(),
            'images' => array_values(array_map(
                fn ($i) => is_string($i) ? ['url' => $i, 'name' => '', 'isPrimary' => false] : $i,
                $p->images ?? [],
            )),
            'isActive' => (bool) $p->is_active,
        ];
        if ($cost) {
            $out['costPrice'] = $main?->cost_price !== null ? (float) $main->cost_price : null;
        }

        return $out;
    }
}
