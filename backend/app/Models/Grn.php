<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Grn extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['posted_at' => 'datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(GrnLine::class)->orderBy('id');
    }

    public function serials(): HasMany
    {
        return $this->hasMany(GrnSerial::class)->orderBy('id');
    }

    public function landedCosts(): HasMany
    {
        return $this->hasMany(GrnLandedCost::class)->orderBy('id');
    }
}
