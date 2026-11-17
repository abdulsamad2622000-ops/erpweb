<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class GrantPolicy
{
    public function __construct(private PermissionResolver $resolver)
    {
    }

    /** Super Admin sab ko; Admin sirf Staff ko; Staff kisi ko nahi. */
    public function canManage(User $actor, User $target): bool
    {
        return match ($actor->type) {
            'super_admin' => true,
            'admin' => $target->type === 'staff',
            default => false,
        };
    }

    /** Admin sirf wohi permission, scope, limit aur expiry de sakta hai jo uske apne paas hai. */
    public function canGrant(
        User $actor,
        string $key,
        string $scope = 'all',
        ?float $limit = null,
        ?CarbonInterface $expiresAt = null,
    ): bool {
        if ($actor->type === 'super_admin') {
            return true;
        }

        if ($actor->type !== 'admin') {
            return false;
        }

        $held = $this->resolver->for($actor)->firstWhere('key', $key);
        if (! $held) {
            return false;
        }

        if ($held['scope'] !== 'all' && $held['scope'] !== $scope) {
            return false;
        }

        if ($held['limit'] !== null && ($limit === null || $limit > $held['limit'])) {
            return false;
        }

        if ($held['expiresAt'] !== null
            && ($expiresAt === null || $expiresAt->gt(Carbon::parse($held['expiresAt'])))) {
            return false;
        }

        return true;
    }
}