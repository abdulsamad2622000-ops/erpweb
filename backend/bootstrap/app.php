<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->alias(['permission' => \App\Http\Middleware\EnsurePermission::class, 'idempotent' => \App\Http\Middleware\Idempotency::class]);
        $middleware->api(prepend: [\App\Http\Middleware\ResetMemo::class], append: [\App\Http\Middleware\SnakeCaseInput::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Kisi record ko mitane ki koshish jo doosri jagah istemal ho raha ho: 500 ki jagah saaf 409.
        $exceptions->render(function (\Illuminate\Database\QueryException $e, Request $request) {
            $code = (int) ($e->errorInfo[1] ?? 0);
            $fk = $code === 1451 || $code === 1452 || str_contains($e->getMessage(), 'FOREIGN KEY constraint failed');
            if ($fk && ($request->is('api/*') || $request->expectsJson())) {
                return response()->json(['message' => 'This record is used elsewhere in the system, so it cannot be deleted or changed. Mark it inactive instead.'], 409);
            }

            return null;
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
