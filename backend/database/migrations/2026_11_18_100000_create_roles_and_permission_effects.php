<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $t) {
            $t->id();
            $t->string('key')->unique();
            $t->string('name');
            $t->boolean('is_system')->default(false);
            $t->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('role_id')->constrained()->cascadeOnDelete();
            $t->string('permission_key');
            $t->string('scope')->default('all');
            $t->decimal('limit_value', 14, 2)->nullable();
            $t->timestamps();
            $t->unique(['role_id', 'permission_key']);
        });

        Schema::table('user_permissions', function (Blueprint $t) {
            $t->string('effect')->default('grant'); // grant | deny
        });
    }

    public function down(): void
    {
        Schema::table('user_permissions', function (Blueprint $t) {
            $t->dropColumn('effect');
        });
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('roles');
    }
};