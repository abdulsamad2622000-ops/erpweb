<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Step 13: customer receipts (ek payment kai invoices par), ledger aur aging isi se.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_receipts', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            $t->string('method', 20);
            $t->decimal('amount', 14, 2);
            $t->string('reference', 60)->nullable();
            $t->string('note', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
        Schema::table('sale_payments', function (Blueprint $t) {
            $t->foreignId('customer_receipt_id')->nullable()->constrained()->nullOnDelete();
        });
        if (! DB::table('number_series')->where('key', 'customer_receipt')->exists()) {
            DB::table('number_series')->insert(['key' => 'customer_receipt', 'name' => 'Customer Receipt', 'prefix' => 'RCV-', 'padding' => 5,
                'next_number' => 1, 'include_year' => false, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::table('sale_payments', function (Blueprint $t) {
            $t->dropConstrainedForeignId('customer_receipt_id');
        });
        Schema::dropIfExists('customer_receipts');
        DB::table('number_series')->where('key', 'customer_receipt')->delete();
    }
};
