<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'permission_audit_logs';

    protected $fillable = ['actor_id', 'target_user_id', 'action', 'details'];

    protected function casts(): array
    {
        return ['details' => 'array'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public static function record(?User $actor, string $action, ?User $target = null, array $details = []): self
    {
        return static::create([
            'actor_id' => $actor?->id,
            'target_user_id' => $target?->id,
            'action' => $action,
            'details' => $details ?: null,
        ]);
    }
}