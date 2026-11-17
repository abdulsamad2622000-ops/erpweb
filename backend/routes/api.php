<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\LocationController;
use App\Http\Controllers\Api\MeController;
use App\Http\Controllers\Api\NumberSeriesController;
use App\Http\Controllers\Api\PermissionRegistryController;
use App\Http\Controllers\Api\PriceTierController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserPermissionController;
use App\Http\Controllers\Api\WarehouseController;
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

    require __DIR__.'/catalog.php';

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

        // Lookups: har logged-in user padh sakta hai (branch selector, dropdowns)
        Route::get('branches', [BranchController::class, 'index']);
        Route::get('warehouses', [WarehouseController::class, 'index']);
        Route::get('warehouses/{warehouse}', [WarehouseController::class, 'show']);
        Route::get('warehouses/{warehouse}/locations', [LocationController::class, 'tree']);
        Route::get('locations/lookup', [LocationController::class, 'lookup']);
        Route::get('price-tiers', [PriceTierController::class, 'index']);

        // Settings screens: sirf settings.manage wale
        Route::middleware('permission:settings.manage')->group(function () {
            Route::get('settings/{group}', [SettingsController::class, 'show']);
            Route::put('settings/{group}', [SettingsController::class, 'update']);

            Route::get('number-series', [NumberSeriesController::class, 'index']);
            Route::put('number-series/{key}', [NumberSeriesController::class, 'update']);

            Route::post('branches', [BranchController::class, 'store']);
            Route::put('branches/{branch}', [BranchController::class, 'update']);
            Route::delete('branches/{branch}', [BranchController::class, 'destroy']);

            Route::post('warehouses', [WarehouseController::class, 'store']);
            Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update']);
            Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy']);

            Route::post('warehouses/{warehouse}/locations', [LocationController::class, 'store']);
            Route::put('locations/{location}', [LocationController::class, 'update']);
            Route::delete('locations/{location}', [LocationController::class, 'destroy']);

            Route::post('price-tiers', [PriceTierController::class, 'store']);
            Route::put('price-tiers/{priceTier}', [PriceTierController::class, 'update']);
            Route::delete('price-tiers/{priceTier}', [PriceTierController::class, 'destroy']);
        });
    });
});