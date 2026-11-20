<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PriceTier extends Model
{
    protected $fillable = ['key', 'name', 'is_active', 'is_default', 'is_system', 'sort_order'];

    protected function casts(): array
    {
        return ['is_default' => 'boolean', 'is_system' => 'boolean'];
    }
}