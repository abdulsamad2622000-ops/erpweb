<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Frontend contract: branch ki city, price tier on/off
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $t) {
            $t->string('city')->nullable()->after('name');
        });
        Schema::table('price_tiers', function (Blueprint $t) {
            $t->boolean('is_active')->default(true)->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('branches', fn (Blueprint $t) => $t->dropColumn('city'));
        Schema::table('price_tiers', fn (Blueprint $t) => $t->dropColumn('is_active'));
    }
};
