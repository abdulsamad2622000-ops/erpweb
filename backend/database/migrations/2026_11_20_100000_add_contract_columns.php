<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Frontend contract ke liye: temporary access aur role description
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->date('access_expires_at')->nullable()->after('is_active');
        });
        Schema::table('roles', function (Blueprint $t) {
            $t->string('description', 500)->default('')->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('access_expires_at'));
        Schema::table('roles', fn (Blueprint $t) => $t->dropColumn('description'));
    }
};
