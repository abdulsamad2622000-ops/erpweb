<?php

namespace App\Http\Middleware;

use App\Support\Memo;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResetMemo
{
    public function handle(Request $request, Closure $next): Response
    {
        Memo::flush();

        return $next($request);
    }
}
