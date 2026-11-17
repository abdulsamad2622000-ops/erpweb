<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\CatalogService;
use App\Services\ProductPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Excel/CSV frontend par parse hoti hai, server ko rows JSON mein milti hain.
 * Har row = ek variant. Same (product_name + brand) wali rows ek product ke variants banti hain.
 */
class ProductImportController extends Controller
{
    private const ROW_RULES = [
        'product_name' => 'required|string|max:255',
        'brand' => 'required|string|max:100',
        'category' => 'nullable|string|max:100',
        'tracking_type' => 'required|in:serialized,batch',
        'sku' => 'required|string|max:64',
        'variant_name' => 'nullable|string|max:255',
        'barcode' => 'nullable|string|max:64',
        'cost_price' => 'nullable|numeric|min:0',
        'retail_price' => 'nullable|numeric|min:0',
        'wholesale_price' => 'nullable|numeric|min:0',
        'dealer_price' => 'nullable|numeric|min:0',
        'warranty_months' => 'nullable|integer|min:0|max:120',
    ];

    public function __construct(private CatalogService $catalog)
    {
    }

    public function preview(Request $request): JsonResponse
    {
        [$results, $valid] = $this->analyze($this->rows($request));

        return response()->json($this->report($results, $valid));
    }

    public function commit(Request $request): JsonResponse
    {
        $rows = $this->rows($request);
        [$results, $valid] = $this->analyze($rows);

        if ($valid !== count($rows)) {
            return response()->json(['message' => 'Fix the errors and try again.'] + $this->report($results, $valid), 422);
        }

        $actor = $request->user();
        $cost = ProductPresenter::canSeeCost($actor);
        $stats = ['products' => 0, 'variants' => 0, 'brands' => 0];

        DB::transaction(function () use ($rows, $actor, $cost, &$stats) {
            foreach ($rows as $r) {
                $brand = Brand::firstOrCreate(['name' => $r['brand']], ['is_active' => true]);
                $stats['brands'] += $brand->wasRecentlyCreated ? 1 : 0;

                $category = ! empty($r['category']) ? Category::where('name', $r['category'])->first() : null;

                $product = Product::firstOrCreate(
                    ['name' => $r['product_name'], 'brand_id' => $brand->id],
                    [
                        'category_id' => $category?->id,
                        'tracking_type' => $r['tracking_type'],
                        'warranty_months' => (int) ($r['warranty_months'] ?? 0),
                        'is_active' => true,
                    ],
                );
                $stats['products'] += $product->wasRecentlyCreated ? 1 : 0;

                $prices = [];
                foreach (['retail', 'wholesale', 'dealer'] as $tier) {
                    $val = $r[$tier.'_price'] ?? null;
                    if ($val !== null && $val !== '') {
                        $prices[] = ['tier' => $tier, 'price' => $val];
                    }
                }

                $this->catalog->createVariant($product, [
                    'sku' => $r['sku'],
                    'name' => $r['variant_name'] ?? null,
                    'barcode' => $r['barcode'] ?? null,
                    'cost_price' => $r['cost_price'] ?? null,
                    'prices' => $prices,
                ], $cost, $actor);
                $stats['variants']++;
            }

            AuditLog::record($actor, 'product.imported', null, $stats);
        });

        return response()->json(['created' => $stats], 201);
    }

    private function rows(Request $request): array
    {
        return array_values($request->validate(['rows' => 'required|array|min:1|max:1000'])['rows']);
    }

    private function report(array $results, int $valid): array
    {
        return [
            'summary' => ['total' => count($results), 'valid' => $valid, 'invalid' => count($results) - $valid],
            'rows' => $results,
        ];
    }

    /** @return array{0: list<array>, 1: int} */
    private function analyze(array $rows): array
    {
        $seenSku = [];
        $seenBarcode = [];
        $products = [];
        $results = [];
        $valid = 0;

        foreach ($rows as $i => $row) {
            $row = is_array($row) ? $row : [];
            $v = Validator::make($row, self::ROW_RULES);
            $errors = $v->fails() ? $v->errors()->toArray() : [];

            $sku = trim((string) ($row['sku'] ?? ''));
            if ($sku !== '' && ! isset($errors['sku'])) {
                if (isset($seenSku[strtolower($sku)])) {
                    $errors['sku'][] = 'Duplicate SKU in this file.';
                } elseif (ProductVariant::where('sku', $sku)->exists()) {
                    $errors['sku'][] = 'This SKU already exists.';
                }
            }
            if ($sku !== '') {
                $seenSku[strtolower($sku)] = true;
            }

            $barcode = trim((string) ($row['barcode'] ?? ''));
            if ($barcode !== '' && ! isset($errors['barcode'])) {
                if (isset($seenBarcode[$barcode]) || ProductVariant::where('barcode', $barcode)->exists()) {
                    $errors['barcode'][] = 'This barcode is already used.';
                }
                $seenBarcode[$barcode] = true;
            }

            if (! empty($row['category']) && ! isset($errors['category'])
                && ! Category::where('name', $row['category'])->exists()) {
                $errors['category'][] = 'Unknown category.';
            }

            $action = 'add_variant';
            if (! isset($errors['product_name']) && ! isset($errors['brand'])) {
                $key = mb_strtolower(trim($row['product_name']).'|'.trim($row['brand']));
                $tracking = $row['tracking_type'] ?? null;

                if (isset($products[$key])) {
                    if ($products[$key] !== $tracking) {
                        $errors['tracking_type'][] = 'This product already uses a different tracking type.';
                    }
                } else {
                    $brand = Brand::where('name', $row['brand'])->first();
                    $existing = $brand ? Product::where('name', $row['product_name'])->where('brand_id', $brand->id)->first() : null;

                    if ($existing && $existing->tracking_type !== $tracking) {
                        $errors['tracking_type'][] = 'This product already uses a different tracking type.';
                    }
                    $products[$key] = $existing?->tracking_type ?? $tracking;
                    $action = $existing ? 'add_variant' : 'create_product';
                }
            }

            if (! $errors) {
                $valid++;
            }

            $results[] = ['row' => $i + 1, 'valid' => ! $errors, 'action' => $action, 'sku' => $sku, 'errors' => $errors];
        }

        return [$results, $valid];
    }
}