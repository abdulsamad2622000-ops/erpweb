<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Purchase (Step 8), inventory serials/stock/transfers (Step 9) aur labels (Step 7).
 * Stock serial-based hai: har laptop ek stock_serials row. Har aana-jaana stock_movements mein.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->string('phone', 30)->default('');
            $t->string('email')->default('');
            $t->string('city', 60)->default('');
            $t->string('tax_number', 30)->default('');
            $t->unsignedSmallInteger('payment_terms_days')->default(30);
            $t->decimal('opening_balance', 14, 2)->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });

        Schema::create('purchase_orders', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->date('order_date');
            $t->date('expected_date')->nullable();
            $t->string('terms', 255)->default('');
            $t->string('status', 30)->default('draft')->index();
            $t->string('approval_note', 500)->nullable();
            $t->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('purchase_order_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('qty');
            $t->decimal('unit_cost', 14, 2);
            $t->unsignedInteger('received_qty')->default(0);
            $t->unique(['purchase_order_id', 'product_id']);
        });

        Schema::create('grns', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('purchase_order_id')->constrained()->restrictOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->string('status', 20)->default('draft')->index();
            $t->timestamp('posted_at')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('grn_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('grn_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('qty')->default(0); // non-serialized lines
            $t->unique(['grn_id', 'product_id']);
        });

        Schema::create('grn_serials', function (Blueprint $t) {
            $t->id();
            $t->foreignId('grn_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->string('serial', 40);
            $t->string('status', 20); // accepted | rejected | quarantine
            $t->string('note', 255)->nullable();
            $t->unique(['grn_id', 'serial']);
            $t->index('serial');
        });

        Schema::create('grn_landed_costs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('grn_id')->constrained()->cascadeOnDelete();
            $t->string('label', 100);
            $t->decimal('amount', 14, 2);
        });

        Schema::create('stock_serials', function (Blueprint $t) {
            $t->id();
            $t->string('serial', 40)->unique();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->foreignId('warehouse_id')->nullable()->constrained()->restrictOnDelete(); // null = raaste mein (transfer)
            $t->string('status', 20)->index(); // in_stock | quarantine | rejected | returned
            $t->foreignId('grn_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('unit_cost', 14, 2)->default(0);
            $t->timestamp('received_at')->nullable();
            $t->timestamps();
        });

        Schema::create('stock_movements', function (Blueprint $t) {
            $t->id();
            $t->timestamp('at')->index();
            $t->string('direction', 3); // in | out
            $t->string('type', 20); // grn | return | transfer_out | transfer_in
            $t->string('serial', 40)->index();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->foreignId('warehouse_id')->nullable()->constrained()->nullOnDelete();
            $t->string('ref', 40);
            $t->string('note', 255)->nullable();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::create('supplier_bills', function (Blueprint $t) {
            $t->id();
            $t->foreignId('purchase_order_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('number', 60);
            $t->date('bill_date');
            $t->decimal('amount', 14, 2);
            $t->timestamps();
        });

        Schema::create('supplier_payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $t->date('date');
            $t->decimal('amount', 14, 2);
            $t->string('method', 20);
            $t->string('reference', 100)->default('');
            $t->string('note', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('purchase_returns', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $t->date('date');
            $t->decimal('total', 14, 2);
            $t->string('reason', 500);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('purchase_return_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('purchase_return_id')->constrained()->cascadeOnDelete();
            $t->string('serial', 40)->unique(); // ek serial ek hi dafa wapas
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->decimal('unit_cost', 14, 2);
        });

        Schema::create('stock_transfers', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('from_warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $t->foreignId('to_warehouse_id')->constrained('warehouses')->restrictOnDelete();
            $t->string('status', 20)->default('requested')->index();
            $t->string('note', 500)->nullable();
            $t->string('reason', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('dispatched_at')->nullable();
            $t->timestamp('received_at')->nullable();
            $t->timestamps();
        });

        Schema::create('stock_transfer_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('stock_transfer_id')->constrained()->cascadeOnDelete();
            $t->string('serial', 40)->index();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->boolean('received')->default(false);
            $t->unique(['stock_transfer_id', 'serial']);
        });

        Schema::create('label_templates', function (Blueprint $t) {
            $t->id();
            $t->string('name', 60);
            $t->string('kind', 10); // sku | serial | bin
            $t->unsignedSmallInteger('width_mm');
            $t->unsignedSmallInteger('height_mm');
            $t->string('symbology', 10); // code128 | qr | ean13
            $t->json('fields');
            $t->boolean('show_logo')->default(false);
            $t->boolean('is_default')->default(false);
            $t->timestamps();
        });

        Schema::create('label_print_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('label_template_id')->nullable()->constrained()->nullOnDelete();
            $t->string('template_name', 60);
            $t->json('codes');
            $t->boolean('is_reprint')->default(false);
            $t->string('reason', 500)->nullable();
            $t->foreignId('printed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });

        Schema::create('label_print_counts', function (Blueprint $t) {
            $t->string('code', 64)->primary();
            $t->unsignedInteger('count')->default(0);
        });

        $now = now();
        foreach ([['transfer', 'Stock Transfer', 'TRF-'], ['purchase_return', 'Purchase Return', 'RET-']] as [$key, $name, $prefix]) {
            if (! DB::table('number_series')->where('key', $key)->exists()) {
                DB::table('number_series')->insert([
                    'key' => $key, 'name' => $name, 'prefix' => $prefix, 'padding' => 4, 'next_number' => 1,
                    'include_year' => false, 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }
        DB::table('label_templates')->insert([
            ['name' => 'Laptop serial 62x32', 'kind' => 'serial', 'width_mm' => 62, 'height_mm' => 32, 'symbology' => 'code128', 'fields' => json_encode(['name', 'specs', 'serial']), 'show_logo' => false, 'is_default' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Shelf price 50x25', 'kind' => 'sku', 'width_mm' => 50, 'height_mm' => 25, 'symbology' => 'code128', 'fields' => json_encode(['name', 'price']), 'show_logo' => false, 'is_default' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Bin QR 50x25', 'kind' => 'bin', 'width_mm' => 50, 'height_mm' => 25, 'symbology' => 'qr', 'fields' => json_encode(['bin', 'code']), 'show_logo' => false, 'is_default' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        foreach ([
            'label_print_counts', 'label_print_logs', 'label_templates', 'stock_transfer_lines', 'stock_transfers',
            'purchase_return_lines', 'purchase_returns', 'supplier_payments', 'supplier_bills', 'stock_movements',
            'stock_serials', 'grn_landed_costs', 'grn_serials', 'grn_lines', 'grns', 'purchase_order_lines',
            'purchase_orders', 'suppliers',
        ] as $table) {
            Schema::dropIfExists($table);
        }
        DB::table('number_series')->whereIn('key', ['transfer', 'purchase_return'])->delete();
    }
};
