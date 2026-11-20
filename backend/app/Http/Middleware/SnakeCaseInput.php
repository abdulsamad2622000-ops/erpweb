<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Frontend camelCase bhejta hai (isActive, branchId, parentId). Backend validation snake_case par hai.
 * Har top-level camelCase key ka snake_case roop bhi request mein daal diya jata hai (asli key bhi rehti hai).
 */
class SnakeCaseInput
{
    public function handle(Request $request, Closure $next): Response
    {
        $extra = [];
        foreach ($request->all() as $key => $value) {
            if (is_string($key) && preg_match('/[a-z][A-Z]/', $key)) {
                $snake = Str::snake($key);
                if (! $request->has($snake)) {
                    $extra[$snake] = $value;
                }
            }
        }
        if ($extra !== []) {
            $request->merge($extra);
        }

        return $next($request);
    }
}
