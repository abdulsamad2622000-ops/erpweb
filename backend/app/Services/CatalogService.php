<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CatalogService
{
    public function __construct(private PriceService $prices)
    {
    }

    public static function variantRules(string $prefix, bool $withPrices = true): array
    {
        $rules = [
            "$prefix.sku" => 'required|string|max:64|distinct|unique:product_variants,sku',
            "$prefix.name" => 'nullable|string|max:255',
            "$prefix.barcode" => 'nullable|string|max:64|unique:product_variants,barcode',
            "$prefix.cost_price" => 'nullable|numeric|min:0',
            "$prefix.is_active" => 'sometimes|boolean',
        ];

        return $withPrices ? $rules + PriceService::rules("$prefix.prices") : $rules;
    }

    /** $canSeeCost false ho to cost_price chupke se ignore hota hai. */
    public function createVariant(Product $product, array $d, bool $canSeeCost, ?User $actor): ProductVariant
    {
        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'sku' => $d['sku'],
            'name' => $d['name'] ?? null,
            'barcode' => $d['barcode'] ?? null,
            'cost_price' => $canSeeCost ? ($d['cost_price'] ?? null) : null,
            'is_active' => $d['is_active'] ?? true,
        ]);

        $this->prices->sync($variant, $d['prices'] ?? [], $actor);

        return $variant;
    }

    public function syncReorderLevels(Product $product, array $levels): void
    {
        DB::table('product_reorder_levels')->where('product_id', $product->id)->delete();

        foreach ($levels as $l) {
            DB::table('product_reorder_levels')->insert([
                'product_id' => $product->id,
                'branch_id' => $l['branchId'],
                'level' => $l['level'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}