<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Serial par koi rok to nahi: active reservation, khuli transfer, pending adjustment. */
class StockHolds
{
    /** Active (aaj tak valid) reservation ka number, nahi to null. */
    public static function reservedRef(string $serial): ?string
    {
        return self::reservedRefs([$serial])[$serial] ?? null;
    }

    /** @return array<string, string> serial => reservation number */
    public static function reservedRefs(array $serials): array
    {
        if (! $serials) {
            return [];
        }

        return DB::table('reservation_lines as l')->join('reservations as r', 'r.id', '=', 'l.reservation_id')
            ->whereIn('l.serial', $serials)->where('r.status', 'active')
            ->where(fn ($q) => $q->whereNull('r.hold_until')->orWhere('r.hold_until', '>=', now()->toDateString()))
            ->pluck('r.number', 'l.serial')->all();
    }

    public static function inOpenTransfer(string $serial): bool
    {
        return DB::table('stock_transfer_lines as l')->join('stock_transfers as t', 't.id', '=', 'l.stock_transfer_id')
            ->where('l.serial', $serial)->whereIn('t.status', ['requested', 'approved'])->exists();
    }

    public static function pendingAdjustment(string $serial): bool
    {
        return DB::table('stock_adjustment_lines as l')->join('stock_adjustments as a', 'a.id', '=', 'l.stock_adjustment_id')
            ->where('l.serial', $serial)->where('a.status', 'pending')->exists();
    }
}
