<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NumberSeries extends Model
{
    protected $table = 'number_series';

    protected $fillable = ['key', 'name', 'prefix', 'padding', 'next_number', 'include_year'];

    protected function casts(): array
    {
        return ['include_year' => 'boolean'];
    }
}