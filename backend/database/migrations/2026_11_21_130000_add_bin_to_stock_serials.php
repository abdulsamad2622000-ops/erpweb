<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Step 9c: put-away ke baad serial kis bin mein hai
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stock_serials', function (Blueprint $t) {
            $t->foreignId('bin_id')->nullable()->after('warehouse_id')->constrained('locations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stock_serials', function (Blueprint $t) {
            $t->dropConstrainedForeignId('bin_id');
        });
    }
};
