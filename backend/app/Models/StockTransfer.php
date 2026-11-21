<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockTransfer extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['dispatched_at' => 'datetime', 'received_at' => 'datetime'];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(StockTransferLine::class)->orderBy('id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
