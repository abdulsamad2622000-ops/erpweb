<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Idempotency-Key header (scan app offline queue): same user + same key = pehla jawab dobara,
 * kaam dobara nahi hota. Sirf kamyaab (2xx) ya 422 jawab 24 ghante yaad rehte hain.
 */
class Idempotency
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = trim((string) $request->header('Idempotency-Key', ''));
        if ($key === '' || ! $request->user() || strlen($key) > 100) {
            return $next($request);
        }
        $id = 'idem:'.$request->user()->id.':'.sha1($request->method().' '.$request->path().' '.$key);
        if ($hit = Cache::get($id)) {
            return response($hit['body'], $hit['status'], ['Content-Type' => 'application/json', 'Idempotent-Replay' => 'true']);
        }
        $lock = Cache::lock($id.':lock', 30);
        if (! $lock->get()) {
            return response()->json(['message' => 'This request is already being processed.'], 409);
        }
        try {
            $res = $next($request);
            $code = $res->getStatusCode();
            if (($code >= 200 && $code < 300) || $code === 422) {
                Cache::put($id, ['status' => $code, 'body' => $res->getContent()], now()->addDay());
            }

            return $res;
        } finally {
            $lock->release();
        }
    }
}
