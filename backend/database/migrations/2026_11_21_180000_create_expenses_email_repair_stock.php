<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Kharche + cash book, email templates/log, aur repair parts stock se (serial).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expense_categories', function (Blueprint $t) {
            $t->id();
            $t->string('name', 80)->unique();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });
        Schema::create('expenses', function (Blueprint $t) {
            $t->id();
            $t->string('number')->unique();
            $t->date('date')->index();
            $t->foreignId('expense_category_id')->constrained()->restrictOnDelete();
            $t->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('amount', 14, 2);
            $t->string('method', 20);
            $t->string('paid_to', 120)->default('');
            $t->string('reference', 60)->nullable();
            $t->string('note', 500)->nullable();
            $t->timestamp('voided_at')->nullable();
            $t->string('void_reason', 500)->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
        });
        Schema::create('email_templates', function (Blueprint $t) {
            $t->id();
            $t->string('key', 40)->unique();
            $t->string('name', 80);
            $t->string('subject', 200);
            $t->text('body');
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });
        Schema::create('email_logs', function (Blueprint $t) {
            $t->id();
            $t->string('template_key', 40)->nullable();
            $t->string('to', 160);
            $t->string('subject', 200);
            $t->string('status', 20); // sent | failed
            $t->string('error', 500)->nullable();
            $t->string('ref', 60)->nullable();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->timestamp('at');
        });
        Schema::table('repair_parts', function (Blueprint $t) {
            $t->string('serial', 40)->nullable();
            $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('unit_cost', 14, 2)->default(0);
        });

        $now = now();
        if (! DB::table('number_series')->where('key', 'expense')->exists()) {
            DB::table('number_series')->insert(['key' => 'expense', 'name' => 'Expense', 'prefix' => 'EXP-', 'padding' => 5, 'next_number' => 1,
                'include_year' => false, 'created_at' => $now, 'updated_at' => $now]);
        }
        foreach (['Rent', 'Salaries', 'Electricity', 'Internet & phone', 'Transport', 'Repairs & maintenance', 'Tea & refreshments', 'Marketing', 'Other'] as $n) {
            DB::table('expense_categories')->insert(['name' => $n, 'created_at' => $now, 'updated_at' => $now]);
        }
        $tpl = [
            ['invoice', 'Invoice', 'Invoice {{number}} from {{company}}',
                "Dear {{customer}},\n\nThank you for your business. Your invoice {{number}} dated {{date}} is for Rs {{total}}.\nBalance due: Rs {{balance}}{{due_line}}.\n\n{{lines}}\n\nRegards,\n{{company}}"],
            ['statement', 'Account statement', 'Account statement from {{company}}',
                "Dear {{customer}},\n\nYour balance with us is Rs {{balance}} as of {{date}}.\n\n{{lines}}\n\nPlease contact us if anything looks wrong.\n\nRegards,\n{{company}}"],
            ['repair_ready', 'Repair ready', 'Your laptop is ready – {{number}}',
                "Dear {{customer}},\n\nYour {{device}} (job {{number}}) is ready for collection. Charges: Rs {{total}}.\n\nRegards,\n{{company}}"],
        ];
        foreach ($tpl as [$k, $n, $s, $b]) {
            DB::table('email_templates')->insert(['key' => $k, 'name' => $n, 'subject' => $s, 'body' => $b, 'created_at' => $now, 'updated_at' => $now]);
        }
    }

    public function down(): void
    {
        Schema::table('repair_parts', function (Blueprint $t) {
            $t->dropConstrainedForeignId('product_id');
            $t->dropColumn(['serial', 'unit_cost']);
        });
        foreach (['email_logs', 'email_templates', 'expenses', 'expense_categories'] as $t) {
            Schema::dropIfExists($t);
        }
        DB::table('number_series')->where('key', 'expense')->delete();
    }
};
