<?php

namespace App\Models;

use App\Exceptions\LastSuperAdminException;
use App\Services\SuperAdminGuard;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name', 'email', 'password', 'type', 'role', 'two_factor_enabled', 'is_active',
        'discount_percent', 'adjustment_units', 'max_sale_without_approval',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected static function booted(): void
    {
        // Aakhri active Super Admin ko downgrade ya deactivate nahi kar sakte
        static::updating(function (User $user) {
            $wasActiveSuper = $user->getOriginal('type') === 'super_admin'
                && (bool) $user->getOriginal('is_active');

            if (! $wasActiveSuper) {
                return;
            }

            $losesPower = $user->type !== 'super_admin' || ! $user->is_active;

            if ($losesPower && SuperAdminGuard::isLastActiveSuperAdmin($user)) {
                throw new LastSuperAdminException();
            }
        });

        // Aur delete bhi nahi
        static::deleting(function (User $user) {
            if ($user->type === 'super_admin' && $user->is_active
                && SuperAdminGuard::isLastActiveSuperAdmin($user)) {
                throw new LastSuperAdminException();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_enabled' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class);
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(UserPermission::class);
    }
}