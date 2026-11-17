<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brands', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->foreignId('parent_id')->nullable()->constrained('categories')->restrictOnDelete();
            $t->string('name');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->foreignId('brand_id')->constrained()->restrictOnDelete();
            $t->foreignId('category_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('tracking_type'); // serialized | batch
            $t->text('description')->nullable();
            $t->json('specs')->nullable();
            $t->unsignedSmallInteger('warranty_months')->default(0);
            $t->json('images')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->index(['brand_id', 'name']);
        });

        Schema::create('product_variants', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->string('sku')->unique();
            $t->string('name')->nullable();
            $t->string('barcode')->nullable()->unique();
            $t->decimal('cost_price', 14, 2)->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('variant_prices', function (Blueprint $t) {
            $t->id();
            $t->foreignId('variant_id')->constrained('product_variants')->cascadeOnDelete();
            $t->foreignId('price_tier_id')->constrained('price_tiers')->cascadeOnDelete();
            $t->decimal('price', 14, 2);
            $t->decimal('min_price', 14, 2)->nullable();
            $t->timestamps();
            $t->unique(['variant_id', 'price_tier_id']);
        });

        Schema::create('price_history', function (Blueprint $t) {
            $t->id();
            $t->foreignId('variant_id')->constrained('product_variants')->cascadeOnDelete();
            $t->foreignId('price_tier_id')->constrained('price_tiers')->cascadeOnDelete();
            $t->decimal('old_price', 14, 2)->nullable();
            $t->decimal('new_price', 14, 2);
            $t->decimal('old_min_price', 14, 2)->nullable();
            $t->decimal('new_min_price', 14, 2)->nullable();
            $t->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('created_at')->useCurrent();
        });

        Schema::create('product_reorder_levels', function (Blueprint $t) {
            $t->id();
            $t->foreignId('product_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $t->unsignedInteger('level');
            $t->timestamps();
            $t->unique(['product_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_reorder_levels');
        Schema::dropIfExists('price_history');
        Schema::dropIfExists('variant_prices');
        Schema::dropIfExists('product_variants');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('brands');
    }
};