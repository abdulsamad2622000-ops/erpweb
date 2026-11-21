<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Product ki kisi price tier (retail/wholesale/dealer) ki price aur min price. Tier na ho to retail. */
class TierPrice
{
    /** @return array{price: ?float, minPrice: ?float} */
    public static function get(int $productId, string $tier): array
    {
        $variant = DB::table('product_variants')->where('product_id', $productId)->orderBy('id')->value('id');
        $row = fn (string $key) => DB::table('variant_prices')->join('price_tiers', 'price_tiers.id', '=', 'variant_prices.price_tier_id')
            ->where('variant_id', $variant)->where('price_tiers.key', $key)->first(['price', 'min_price']);
        $r = $row($tier) ?? $row('retail');

        return ['price' => $r ? (float) $r->price : null, 'minPrice' => $r && $r->min_price !== null ? (float) $r->min_price : null];
    }
}
