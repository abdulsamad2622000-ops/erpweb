<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LabelPrintLog extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['codes' => 'array', 'is_reprint' => 'boolean'];
    }

    public function printer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'printed_by');
    }
}
