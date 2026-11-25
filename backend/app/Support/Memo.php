<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Ek request ke andar baar baar hone wali chhoti lookups ka cache (naam, product info).
 * ResetMemo middleware har request ke shuru mein saaf karta hai.
 */
class Memo
{
    private static array $store = [];

    public static function remember(string $key, callable $fn): mixed
    {
        if (! array_key_exists($key, self::$store)) {
            self::$store[$key] = $fn();
        }

        return self::$store[$key];
    }

    public static function flush(): void
    {
        self::$store = [];
    }

    public static function userName($id): string
    {
        return $id ? self::remember("user:{$id}", fn () => (string) DB::table('users')->where('id', $id)->value('name')) : '';
    }

    public static function warehouseName($id): string
    {
        return $id ? self::remember("wh:{$id}", fn () => (string) DB::table('warehouses')->where('id', $id)->value('name')) : '';
    }
}
