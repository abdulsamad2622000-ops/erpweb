<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Warehouse extends Model
{
    public const TYPES = ['sellable', 'showroom', 'damaged', 'quarantine', 'repair', 'returns', 'in_transit'];

    protected $fillable = ['branch_id', 'name', 'code', 'type', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}