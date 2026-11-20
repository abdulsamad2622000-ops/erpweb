<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Frontend ka list contract: ?page=&pageSize=&search=&sort=field:asc|desc
 * Jawab: { data: [...], total: n } (purane clients ke liye meta bhi).
 */
class ApiQuery
{
    public static function perPage(Request $request, int $default = 10): int
    {
        $n = (int) ($request->query('pageSize') ?? $request->query('per_page') ?? $default);

        return min(max($n, 1), 500);
    }

    /** @param array<string, string> $map frontend field => DB column (whitelist) */
    public static function sort(Builder $query, Request $request, array $map, string $fallback): Builder
    {
        [$field, $dir] = array_pad(explode(':', (string) $request->query('sort', '')), 2, 'asc');
        if (isset($map[$field])) {
            return $query->orderBy($map[$field], $dir === 'desc' ? 'desc' : 'asc');
        }

        return $query->orderBy($fallback);
    }

    /** Pehla non-empty query value (naya naam pehle, purana baad mein). */
    public static function param(Request $request, string ...$names): ?string
    {
        foreach ($names as $n) {
            $v = $request->query($n);
            if ($v !== null && $v !== '') {
                return (string) $v;
            }
        }

        return null;
    }

    public static function page(LengthAwarePaginator $page, callable $present): array
    {
        return [
            'data' => $page->getCollection()->map($present)->values(),
            'total' => $page->total(),
            'meta' => [
                'page' => $page->currentPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'lastPage' => $page->lastPage(),
            ],
        ];
    }
}
