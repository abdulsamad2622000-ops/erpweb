<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('type')->default('staff');          // super_admin | admin | staff
            $t->string('role')->nullable();
            $t->boolean('two_factor_enabled')->default(false);
            $t->boolean('is_active')->default(true);
            $t->decimal('discount_percent', 5, 2)->nullable();
            $t->unsignedInteger('adjustment_units')->nullable();
            $t->unsignedBigInteger('max_sale_without_approval')->nullable();
        });

        Schema::create('branches', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->timestamps();
        });

        Schema::create('branch_user', function (Blueprint $t) {
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $t->primary(['user_id', 'branch_id']);
        });

        Schema::create('user_permissions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->string('permission_key');
            $t->string('scope')->default('all');
            $t->timestamp('expires_at')->nullable();
            $t->decimal('limit_value', 14, 2)->nullable();
            $t->timestamps();
            $t->unique(['user_id', 'permission_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('branch_user');
        Schema::dropIfExists('branches');
        Schema::table('users', function (Blueprint $t) {
            $t->dropColumn(['type', 'role', 'two_factor_enabled', 'is_active',
                'discount_percent', 'adjustment_units', 'max_sale_without_approval']);
        });
    }
};