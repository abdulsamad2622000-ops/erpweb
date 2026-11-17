<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PriceHistory;
use App\Models\PriceTier;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\CatalogService;
use App\Services\PriceService;
use App\Services\ProductPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VariantController extends Controller
{
    public function __construct(private CatalogService $catalog, private PriceService $prices)
    {
    }

    public function store(Request $request, Product $product): JsonResponse
    {
        // API flat body leti hai (sku, name, prices...); rules 'variant.' prefix ke saath hain
        $data = Validator::make(['variant' => $request->all()], CatalogService::variantRules('variant'))->validate();
        $actor = $request->user();
        $cost = ProductPresenter::canSeeCost($actor);

        $variant = DB::transaction(function () use ($product, $data, $actor, $cost) {
            $v = $this->catalog->createVariant($product, $data['variant'], $cost, $actor);
            AuditLog::record($actor, 'variant.created', null, ['sku' => $v->sku]);

            return $v;
        });

        return response()->json(['data' => ProductPresenter::variant($variant->fresh(), $cost)], 201);
    }

    public function update(Request $request, ProductVariant $variant): JsonResponse
    {
        $actor = $request->user();
        $cost = ProductPresenter::canSeeCost($actor);

        $data = $request->validate([
            'sku' => ['sometimes', 'required', 'string', 'max:64', Rule::unique('product_variants', 'sku')->ignore($variant->id)],
            'name' => 'sometimes|nullable|string|max:255',
            'barcode' => ['sometimes', 'nullable', 'string', 'max:64', Rule::unique('product_variants', 'barcode')->ignore($variant->id)],
            'cost_price' => 'sometimes|nullable|numeric|min:0',
            'is_active' => 'sometimes|boolean',
        ] + PriceService::rules('prices'));

        $attrs = array_intersect_key($data, array_flip(['sku', 'name', 'barcode', 'is_active']));
        if ($cost && array_key_exists('cost_price', $data)) {
            $attrs['cost_price'] = $data['cost_price'];
        }

        DB::transaction(function () use ($variant, $attrs, $data, $actor) {
            $variant->update($attrs);
            if (isset($data['prices'])) {
                $this->prices->sync($variant, $data['prices'], $actor);
            }
            AuditLog::record($actor, 'variant.updated', null, ['sku' => $variant->sku, 'fields' => array_keys($data)]);
        });

        return response()->json(['data' => ProductPresenter::variant($variant->fresh(), $cost)]);
    }

    public function prices(Request $request, ProductVariant $variant): JsonResponse
    {
        $data = $request->validate(['prices' => 'required|array|min:1'] + PriceService::rules('prices'));

        DB::transaction(function () use ($request, $variant, $data) {
            $this->prices->sync($variant, $data['prices'], $request->user());
            AuditLog::record($request->user(), 'variant.prices_updated', null, ['sku' => $variant->sku]);
        });

        return response()->json(['data' => ProductPresenter::variant($variant->fresh(), ProductPresenter::canSeeCost($request->user()))]);
    }

    public function history(ProductVariant $variant): JsonResponse
    {
        $rows = PriceHistory::where('variant_id', $variant->id)->orderByDesc('id')->limit(200)->get();
        $tiers = PriceTier::pluck('key', 'id')->all();
        $users = User::whereIn('id', $rows->pluck('changed_by')->filter()->unique())->pluck('name', 'id')->all();

        return response()->json([
            'data' => $rows->map(fn ($h) => ProductPresenter::history($h, $tiers, $users))->values(),
        ]);
    }

    public function destroy(Request $request, ProductVariant $variant): Response
    {
        if (ProductVariant::where('product_id', $variant->product_id)->count() <= 1) {
            throw ValidationException::withMessages(['variant' => 'A product must keep at least one variant.']);
        }

        $sku = $variant->sku;
        $variant->delete();
        AuditLog::record($request->user(), 'variant.deleted', null, ['sku' => $sku]);

        return response()->noContent();
    }
}