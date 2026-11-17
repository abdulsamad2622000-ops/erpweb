<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $t) {
            if (! Schema::hasColumn('branches', 'code')) {
                $t->string('code')->nullable()->unique();
            }
            if (! Schema::hasColumn('branches', 'address')) {
                $t->string('address')->nullable();
            }
            if (! Schema::hasColumn('branches', 'phone')) {
                $t->string('phone')->nullable();
            }
            if (! Schema::hasColumn('branches', 'is_active')) {
                $t->boolean('is_active')->default(true);
            }
        });

        Schema::create('app_settings', function (Blueprint $t) {
            $t->id();
            $t->string('key')->unique();
            $t->json('value')->nullable();
            $t->timestamps();
        });

        Schema::create('number_series', function (Blueprint $t) {
            $t->id();
            $t->string('key')->unique();
            $t->string('name');
            $t->string('prefix')->default('');
            $t->unsignedTinyInteger('padding')->default(5);
            $t->unsignedBigInteger('next_number')->default(1);
            $t->boolean('include_year')->default(false);
            $t->timestamps();
        });

        Schema::create('warehouses', function (Blueprint $t) {
            $t->id();
            $t->foreignId('branch_id')->constrained()->restrictOnDelete();
            $t->string('name');
            $t->string('code');
            $t->string('type');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
            $t->unique(['branch_id', 'code']);
        });

        Schema::create('locations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $t->foreignId('parent_id')->nullable()->constrained('locations')->restrictOnDelete();
            $t->string('level'); // zone | rack | shelf | bin
            $t->string('name');
            $t->string('code');
            $t->string('barcode')->nullable()->unique();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('price_tiers', function (Blueprint $t) {
            $t->id();
            $t->string('key')->unique();
            $t->string('name');
            $t->boolean('is_default')->default(false);
            $t->boolean('is_system')->default(false);
            $t->unsignedSmallInteger('sort_order')->default(0);
            $t->timestamps();
        });

        // Reference data: default number series aur price tiers
        $now = now();
        DB::table('number_series')->insert([
            ['key' => 'po', 'name' => 'Purchase Order', 'prefix' => 'PO-', 'padding' => 5, 'next_number' => 1, 'include_year' => false, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'grn', 'name' => 'Goods Receipt (GRN)', 'prefix' => 'GRN-', 'padding' => 5, 'next_number' => 1, 'include_year' => false, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'invoice', 'name' => 'Sales Invoice', 'prefix' => 'INV-', 'padding' => 5, 'next_number' => 1, 'include_year' => false, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'quotation', 'name' => 'Quotation', 'prefix' => 'QT-', 'padding' => 5, 'next_number' => 1, 'include_year' => false, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'sales_order', 'name' => 'Sales Order', 'prefix' => 'SO-', 'padding' => 5, 'next_number' => 1, 'include_year' => false, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'challan', 'name' => 'Delivery Challan', 'prefix' => 'DC-', 'padding' => 5, 'next_number' => 1, 'include_year' => false, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('price_tiers')->insert([
            ['key' => 'retail', 'name' => 'Retail', 'is_default' => true, 'is_system' => true, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'wholesale', 'name' => 'Wholesale', 'is_default' => false, 'is_system' => true, 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'dealer', 'name' => 'Dealer', 'is_default' => false, 'is_system' => true, 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('price_tiers');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('warehouses');
        Schema::dropIfExists('number_series');
        Schema::dropIfExists('app_settings');

        Schema::table('branches', function (Blueprint $t) {
            if (Schema::hasColumn('branches', 'code')) {
                $t->dropUnique(['code']);
                $t->dropColumn('code');
            }
            foreach (['address', 'phone', 'is_active'] as $col) {
                if (Schema::hasColumn('branches', $col)) {
                    $t->dropColumn($col);
                }
            }
        });
    }
};