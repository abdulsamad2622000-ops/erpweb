<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Step 9b: stock counts, adjustments (approval ke saath), customer reservations
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_counts', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->string('status', 20)->default('open')->index();
            $t->string('note', 500)->nullable();
            $t->string('reason', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('submitted_at')->nullable();
            $t->timestamp('decided_at')->nullable();
            $t->timestamps();
        });
        Schema::create('stock_count_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('stock_count_id')->constrained()->cascadeOnDelete();
            $t->string('kind', 10); // expected | counted
            $t->string('serial', 40);
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->unique(['stock_count_id', 'kind', 'serial']);
        });

        Schema::create('stock_adjustments', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->string('kind', 20); // damage | quarantine | release
            $t->string('status', 20)->default('pending')->index();
            $t->string('reason', 500);
            $t->string('decision_note', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('decided_at')->nullable();
            $t->timestamps();
        });
        Schema::create('stock_adjustment_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('stock_adjustment_id')->constrained()->cascadeOnDelete();
            $t->string('serial', 40)->index();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->string('from_status', 20);
            $t->string('to_status', 20);
        });

        Schema::create('reservations', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->string('customer_name', 100);
            $t->string('note', 500)->nullable();
            $t->date('hold_until')->nullable();
            $t->string('status', 20)->default('active')->index(); // active | released (expired = hold_until guzar gayi)
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('released_at')->nullable();
            $t->timestamps();
        });
        Schema::create('reservation_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('reservation_id')->constrained()->cascadeOnDelete();
            $t->string('serial', 40)->index();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
        });

        $now = now();
        foreach ([['stock_count', 'Stock Count', 'CNT-'], ['stock_adjustment', 'Stock Adjustment', 'ADJ-'], ['reservation', 'Reservation', 'RSV-']] as [$key, $name, $prefix]) {
            if (! DB::table('number_series')->where('key', $key)->exists()) {
                DB::table('number_series')->insert(['key' => $key, 'name' => $name, 'prefix' => $prefix, 'padding' => 4, 'next_number' => 1,
                    'include_year' => false, 'created_at' => $now, 'updated_at' => $now]);
            }
        }
    }

    public function down(): void
    {
        foreach (['reservation_lines', 'reservations', 'stock_adjustment_lines', 'stock_adjustments', 'stock_count_lines', 'stock_counts'] as $t) {
            Schema::dropIfExists($t);
        }
        DB::table('number_series')->whereIn('key', ['stock_count', 'stock_adjustment', 'reservation'])->delete();
    }
};
