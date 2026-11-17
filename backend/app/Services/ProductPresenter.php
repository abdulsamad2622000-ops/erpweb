<?php

namespace App\Services;

use App\Models\PriceHistory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ProductPresenter
{
    public static function canSeeCost(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        return $user->type === 'super_admin'
            || app(PermissionResolver::class)->has($user, 'products.cost.view');
    }

    public static function variant(ProductVariant $v, bool $cost): array
    {
        $v->loadMissing('prices.tier');

        $out = [
            'id' => $v->id,
            'productId' => $v->product_id,
            'sku' => $v->sku,
            'name' => $v->name,
            'barcode' => $v->barcode,
            'isActive' => (bool) $v->is_active,
            'prices' => $v->prices->map(fn ($p) => [
                'tier' => $p->tier?->key,
                'price' => (float) $p->price,
                'minPrice' => $p->min_price !== null ? (float) $p->min_price : null,
            ])->sortBy('tier')->values(),
        ];

        if ($cost) {
            $out['costPrice'] = $v->cost_price !== null ? (float) $v->cost_price : null;
        }

        return $out;
    }

    public static function product(Product $p, bool $cost, bool $detail = true): array
    {
        $p->loadMissing(['brand', 'category']);

        $out = [
            'id' => $p->id,
            'name' => $p->name,
            'brand' => $p->brand ? ['id' => $p->brand->id, 'name' => $p->brand->name] : null,
            'category' => $p->category ? ['id' => $p->category->id, 'name' => $p->category->name] : null,
            'trackingType' => $p->tracking_type,
            'description' => $p->description,
            'specs' => $p->specs,
            'warrantyMonths' => (int) $p->warranty_months,
            'images' => $p->images ?? [],
            'isActive' => (bool) $p->is_active,
            'variantsCount' => $p->variants_count ?? $p->variants()->count(),
        ];

        if ($detail) {
            $p->loadMissing('variants.prices.tier');
            $out['variants'] = $p->variants->sortBy('id')->map(fn ($v) => self::variant($v, $cost))->values();
            $out['reorderLevels'] = DB::table('product_reorder_levels')
                ->where('product_id', $p->id)->orderBy('branch_id')->get()
                ->map(fn ($r) => ['branchId' => (int) $r->branch_id, 'level' => (int) $r->level])->values();
        }

        return $out;
    }

    public static function history(PriceHistory $h, array $tiers, array $users): array
    {
        return [
            'id' => $h->id,
            'tier' => $tiers[$h->price_tier_id] ?? null,
            'oldPrice' => $h->old_price !== null ? (float) $h->old_price : null,
            'newPrice' => (float) $h->new_price,
            'oldMinPrice' => $h->old_min_price !== null ? (float) $h->old_min_price : null,
            'newMinPrice' => $h->new_min_price !== null ? (float) $h->new_min_price : null,
            'changedBy' => $h->changed_by ? ($users[$h->changed_by] ?? null) : null,
            'createdAt' => $h->created_at?->toIso8601String(),
        ];
    }
}