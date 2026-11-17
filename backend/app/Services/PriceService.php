<?php

namespace App\Services;

use App\Models\PriceHistory;
use App\Models\PriceTier;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\VariantPrice;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PriceService
{
    public static function rules(string $prefix = 'prices'): array
    {
        return [
            $prefix => 'sometimes|array',
            "$prefix.*.tier" => ['required', 'string', Rule::exists('price_tiers', 'key')],
            "$prefix.*.price" => 'required|numeric|min:0',
            "$prefix.*.minPrice" => 'nullable|numeric|min:0',
        ];
    }

    /** Sirf bheji gayi tiers badalti hain. Har asli tabdeeli price history mein jati hai. */
    public function sync(ProductVariant $variant, array $prices, ?User $actor): void
    {
        foreach ($prices as $p) {
            $tier = PriceTier::where('key', $p['tier'])->firstOrFail();
            $new = round((float) $p['price'], 2);
            $min = isset($p['minPrice']) ? round((float) $p['minPrice'], 2) : null;

            if ($min !== null && $min > $new) {
                throw ValidationException::withMessages([
                    'prices' => "The minimum price cannot be above the price ({$tier->key}).",
                ]);
            }

            $keys = ['variant_id' => $variant->id, 'price_tier_id' => $tier->id];
            $row = VariantPrice::where($keys)->first();
            $oldPrice = $row ? (float) $row->price : null;
            $oldMin = $row && $row->min_price !== null ? (float) $row->min_price : null;

            if ($row && $oldPrice === $new && $oldMin === $min) {
                continue;
            }

            VariantPrice::updateOrCreate($keys, ['price' => $new, 'min_price' => $min]);

            PriceHistory::create($keys + [
                'old_price' => $oldPrice,
                'new_price' => $new,
                'old_min_price' => $oldMin,
                'new_min_price' => $min,
                'changed_by' => $actor?->id,
            ]);
        }
    }
}