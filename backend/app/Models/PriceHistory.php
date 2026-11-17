<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PriceHistory extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'price_history';

    protected $fillable = [
        'variant_id', 'price_tier_id', 'old_price', 'new_price',
        'old_min_price', 'new_min_price', 'changed_by',
    ];
}