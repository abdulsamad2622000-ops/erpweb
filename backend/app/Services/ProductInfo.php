<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\Memo;

/** Purchase/stock screens ke liye product ka chhota khulasa (naam, main SKU, serialized?). */
class ProductInfo
{
    public static function get(int $productId): array
    {
        return Memo::remember("product:{$productId}", fn () => self::load($productId));
    }

    private static function load(int $productId): array
    {
        $p = Product::find($productId);
        $main = ProductVariant::where('product_id', $productId)->orderBy('id')->first();
        $specs = $p?->specs ? implode(' / ', array_filter([$p->specs['cpu'] ?? null, $p->specs['ram'] ?? null, $p->specs['storage'] ?? null])) : null;
        $retail = $main?->prices()->whereHas('tier', fn ($t) => $t->where('key', 'retail'))->value('price');

        return [
            'id' => $productId,
            'name' => (string) $p?->name,
            'sku' => (string) $main?->sku,
            'barcode' => $main?->barcode,
            'serialized' => $p?->tracking_type !== 'batch',
            'specs' => $specs ?: null,
            'price' => $retail !== null ? (float) $retail : null,
            'costPrice' => $main?->cost_price !== null ? (float) $main->cost_price : null,
            'isActive' => (bool) $p?->is_active,
        ];
    }
}
