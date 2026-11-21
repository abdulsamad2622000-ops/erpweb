<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Step 11 Wholesale: quotation -> sales order -> delivery challan (serials out) -> invoice (credit) -> receipts
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $t) {
            $t->unsignedSmallInteger('payment_terms_days')->default(0);
            $t->string('address', 300)->default('');
            $t->string('city', 80)->default('');
        });

        Schema::create('quotations', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            $t->string('status', 20)->default('draft'); // draft | sent | accepted | cancelled
            $t->date('valid_until')->nullable();
            $t->decimal('total', 14, 2)->default(0);
            $t->string('note', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
        Schema::create('quotation_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('qty');
            $t->decimal('unit_price', 14, 2);
        });

        Schema::create('sales_orders', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            $t->foreignId('quotation_id')->nullable()->constrained()->nullOnDelete();
            $t->string('status', 20)->default('open'); // open | partial | delivered | cancelled
            $t->decimal('total', 14, 2)->default(0);
            $t->string('note', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
        Schema::create('sales_order_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sales_order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->unsignedInteger('qty');
            $t->unsignedInteger('delivered_qty')->default(0);
            $t->decimal('unit_price', 14, 2);
        });

        Schema::create('challans', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('sales_order_id')->constrained()->restrictOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->foreignId('sale_id')->nullable(); // invoice (sales.id) jab ban jaye
            $t->string('note', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
        Schema::create('challan_lines', function (Blueprint $t) {
            $t->id();
            $t->foreignId('challan_id')->constrained()->cascadeOnDelete();
            $t->foreignId('sales_order_line_id')->constrained()->restrictOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->string('serial', 40)->nullable();
            $t->unsignedInteger('qty')->default(1);
        });

        Schema::table('sales', function (Blueprint $t) {
            $t->foreignId('challan_id')->nullable();
            $t->date('due_date')->nullable();
        });
        Schema::table('sale_payments', function (Blueprint $t) {
            $t->string('reference', 60)->nullable();
            $t->timestamp('paid_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sale_payments', fn (Blueprint $t) => $t->dropColumn(['reference', 'paid_at']));
        Schema::table('sales', fn (Blueprint $t) => $t->dropColumn(['challan_id', 'due_date']));
        foreach (['challan_lines', 'challans', 'sales_order_lines', 'sales_orders', 'quotation_lines', 'quotations'] as $t) {
            Schema::dropIfExists($t);
        }
        Schema::table('customers', fn (Blueprint $t) => $t->dropColumn(['payment_terms_days', 'address', 'city']));
    }
};
