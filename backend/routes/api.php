<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\PermissionRegistryController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserPermissionController;
use App\Http\Middleware\EnsureUserType;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:10,1');
        Route::post('two-factor', [AuthController::class, 'twoFactor'])->middleware('throttle:10,1');
        Route::post('two-factor/resend', [AuthController::class, 'resend'])->middleware('throttle:10,1');
        Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
    });

    Route::get('me', MeController::class)->middleware('auth:sanctum');

    Route::middleware('auth:sanctum')->group(function () {
        // Super Admin aur Admin: users, overrides, roles (dekhna), registry, audit log
        Route::middleware(EnsureUserType::class.':super_admin,admin')->group(function () {
            Route::get('permissions/registry', PermissionRegistryController::class);
            Route::get('audit-log', [AuditLogController::class, 'index']);

            Route::get('users', [UserController::class, 'index']);
            Route::post('users', [UserController::class, 'store']);
            Route::get('users/{user}', [UserController::class, 'show']);
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::patch('users/{user}/status', [UserController::class, 'status']);
            Route::post('users/{user}/force-logout', [UserController::class, 'forceLogout']);
            Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);
            Route::get('users/{user}/overrides', [UserPermissionController::class, 'show']);
            Route::put('users/{user}/overrides', [UserPermissionController::class, 'update']);

            Route::get('roles', [RoleController::class, 'index']);
            Route::get('roles/{role}', [RoleController::class, 'show']);
        });

        // Sirf Super Admin: roles banana, badalna, clone, delete
        Route::middleware(EnsureUserType::class.':super_admin')->group(function () {
            Route::post('roles', [RoleController::class, 'store']);
            Route::put('roles/{role}', [RoleController::class, 'update']);
            Route::post('roles/{role}/clone', [RoleController::class, 'clone']);
            Route::delete('roles/{role}', [RoleController::class, 'destroy']);
        });
    });
});