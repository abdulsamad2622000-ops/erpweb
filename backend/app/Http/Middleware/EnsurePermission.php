<?php

namespace App\Http\Middleware;

use App\Services\PermissionResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function __construct(private PermissionResolver $resolver)
    {
    }

    public function handle(Request $request, Closure $next, string $key): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        // Super Admin ke paas hamesha har permission hoti hai (naya key config mein na bhi ho)
        if ($user->type !== 'super_admin' && ! $this->resolver->has($user, $key)) {
            return response()->json(['message' => 'This action is unauthorized.'], 403);
        }

        return $next($request);
    }
}