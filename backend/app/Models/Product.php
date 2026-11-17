<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    public const TRACKING_TYPES = ['serialized', 'batch'];

    protected $fillable = [
        'name', 'brand_id', 'category_id', 'tracking_type', 'description',
        'specs', 'warranty_months', 'images', 'is_active',
    ];

    protected function casts(): array
    {
        return ['specs' => 'array', 'images' => 'array', 'is_active' => 'boolean'];
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class);
    }
}