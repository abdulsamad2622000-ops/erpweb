<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permission_audit_logs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('target_user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('action');
            $t->json('details')->nullable();
            $t->timestamp('created_at')->useCurrent();
            $t->index(['action', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permission_audit_logs');
    }
};