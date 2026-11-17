<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPermission extends Model
{
    protected $fillable = ['user_id', 'permission_key', 'effect', 'scope', 'expires_at', 'limit_value'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }
}