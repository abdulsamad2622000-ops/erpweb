<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Step 12 Retail POS: customers (basic), cashier shifts, sales, payments, held bills, sales returns
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $t) {
            $t->id();
            $t->string('name', 120);
            $t->string('phone', 30)->default('')->index();
            $t->string('email', 120)->default('');
            $t->string('type', 20)->default('retail'); // retail | wholesale | dealer
            $t->string('price_tier', 20)->default('retail');
            $t->decimal('credit_limit', 14, 2)->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('pos_shifts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->restrictOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->decimal('opening_cash', 14, 2);
            $t->timestamp('opened_at');
            $t->timestamp('closed_at')->nullable();
            $t->decimal('counted_cash', 14, 2)->nullable();
            $t->decimal('expected_cash', 14, 2)->nullable();
            $t->string('note', 500)->nullable();
            $t->index(['user_id', 'closed_at']);
        });

        Schema::create('sales', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->string('channel', 20)->default('pos'); // pos | wholesale
            $t->foreignId('pos_shift_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('subtotal', 14, 2);
            $t->decimal('discount', 14, 2)->default(0);
            $t->decimal('total', 14, 2);
            $t->decimal('paid', 14, 2);
            $t->decimal('change_due', 14, 2)->default(0);
            $t->string('note', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('sale_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->string('serial', 40)->nullable()->index();
            $t->unsignedInteger('qty')->default(1);
            $t->decimal('unit_price', 14, 2);
            $t->unsignedSmallInteger('warranty_months')->default(0);
            $t->unsignedInteger('returned_qty')->default(0);
        });

        Schema::create('sale_payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sale_id')->constrained()->cascadeOnDelete();
            $t->string('method', 20); // cash | card | transfer
            $t->decimal('amount', 14, 2);
        });

        Schema::create('pos_holds', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('label', 60);
            $t->json('payload');
            $t->timestamps();
        });

        Schema::create('sales_returns', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('sale_id')->constrained()->restrictOnDelete();
            $t->foreignId('pos_shift_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('amount', 14, 2);
            $t->string('refund_method', 20);
            $t->string('reason', 500);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('sales_return_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sales_return_id')->constrained()->cascadeOnDelete();
            $t->foreignId('sale_line_id')->constrained()->restrictOnDelete();
            $t->string('serial', 40)->nullable();
            $t->unsignedInteger('qty');
            $t->decimal('amount', 14, 2);
        });

        $now = now();
        if (! DB::table('number_series')->where('key', 'sales_return')->exists()) {
            DB::table('number_series')->insert(['key' => 'sales_return', 'name' => 'Sales Return', 'prefix' => 'SR-', 'padding' => 5, 'next_number' => 1,
                'include_year' => false, 'created_at' => $now, 'updated_at' => $now]);
        }
    }

    public function down(): void
    {
        foreach (['sales_return_lines', 'sales_returns', 'pos_holds', 'sale_payments', 'sale_lines', 'sales', 'pos_shifts', 'customers'] as $t) {
            Schema::dropIfExists($t);
        }
        DB::table('number_series')->where('key', 'sales_return')->delete();
    }
};
