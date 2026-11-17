<?php

use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductImportController;
use App\Http\Controllers\Api\VariantController;
use Illuminate\Support\Facades\Route;

// api.php ke v1 group ke andar require hota hai
Route::middleware('auth:sanctum')->group(function () {
    Route::middleware('permission:products.product.view')->group(function () {
        Route::get('brands', [BrandController::class, 'index']);
        Route::get('categories', [CategoryController::class, 'index']);
        Route::get('products', [ProductController::class, 'index']);
        Route::get('products/{product}', [ProductController::class, 'show']);
        Route::get('variants/{variant}/price-history', [VariantController::class, 'history']);
    });

    Route::middleware('permission:products.product.create')->group(function () {
        Route::post('products/import/validate', [ProductImportController::class, 'preview']);
        Route::post('products/import', [ProductImportController::class, 'commit']);
        Route::post('products', [ProductController::class, 'store']);
        Route::post('products/{product}/variants', [VariantController::class, 'store']);
    });

    Route::middleware('permission:products.product.edit')->group(function () {
        Route::post('brands', [BrandController::class, 'store']);
        Route::put('brands/{brand}', [BrandController::class, 'update']);
        Route::delete('brands/{brand}', [BrandController::class, 'destroy']);

        Route::post('categories', [CategoryController::class, 'store']);
        Route::put('categories/{category}', [CategoryController::class, 'update']);
        Route::delete('categories/{category}', [CategoryController::class, 'destroy']);

        Route::put('products/{product}', [ProductController::class, 'update']);
        Route::put('variants/{variant}', [VariantController::class, 'update']);
        Route::put('variants/{variant}/prices', [VariantController::class, 'prices']);
        Route::delete('variants/{variant}', [VariantController::class, 'destroy']);
    });

    Route::middleware('permission:products.product.delete')->group(function () {
        Route::delete('products/{product}', [ProductController::class, 'destroy']);
    });
});