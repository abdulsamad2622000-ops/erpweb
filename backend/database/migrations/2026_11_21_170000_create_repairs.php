<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Step 14: warranty check + repair job cards (status timeline, parts, charges, delivery)
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('repair_jobs', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->string('serial', 60)->nullable()->index();
            $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $t->string('device', 160);
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->string('customer_name', 120);
            $t->string('customer_phone', 30);
            $t->foreignId('sale_id')->nullable()->constrained()->nullOnDelete();
            $t->string('warranty', 20); // in_warranty | expired | not_ours
            $t->date('warranty_until')->nullable();
            $t->string('problem', 1000);
            $t->string('accessories', 300)->default('');
            $t->string('diagnosis', 1000)->nullable();
            $t->string('status', 20)->default('received');
            $t->decimal('estimate', 14, 2)->nullable();
            $t->decimal('labour', 14, 2)->default(0);
            $t->decimal('paid', 14, 2)->default(0);
            $t->string('paid_method', 20)->nullable();
            $t->date('promised_on')->nullable();
            $t->timestamp('delivered_at')->nullable();
            $t->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index('status');
        });
        Schema::create('repair_parts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('repair_job_id')->constrained()->cascadeOnDelete();
            $t->string('description', 160);
            $t->unsignedInteger('qty')->default(1);
            $t->decimal('unit_price', 14, 2)->default(0);
        });
        Schema::create('repair_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('repair_job_id')->constrained()->cascadeOnDelete();
            $t->string('status', 20);
            $t->string('note', 500)->nullable();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->timestamp('at');
        });
        if (! DB::table('number_series')->where('key', 'job_card')->exists()) {
            DB::table('number_series')->insert(['key' => 'job_card', 'name' => 'Repair Job Card', 'prefix' => 'JOB-', 'padding' => 5,
                'next_number' => 1, 'include_year' => false, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('repair_events');
        Schema::dropIfExists('repair_parts');
        Schema::dropIfExists('repair_jobs');
        DB::table('number_series')->where('key', 'job_card')->delete();
    }
};
