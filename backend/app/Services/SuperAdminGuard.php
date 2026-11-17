<?php

namespace App\Services;

use App\Models\User;

class SuperAdminGuard
{
    /** Is $user the only active Super Admin left? */
    public static function isLastActiveSuperAdmin(User $user): bool
    {
        return ! User::query()
            ->where('type', 'super_admin')
            ->where('is_active', true)
            ->whereKeyNot($user->getKey())
            ->exists();
    }
}