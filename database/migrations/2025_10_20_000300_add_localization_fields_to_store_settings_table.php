<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('store_settings', function (Blueprint $table): void {
            $table->string('currency_code', 3)->default('IDR')->after('receipt_footer_text');
            $table->string('currency_symbol', 10)->default('Rp')->after('currency_code');
            $table->string('language_code', 20)->default('id-ID')->after('currency_symbol');
            $table->string('timezone', 100)->default('Asia/Jakarta')->after('language_code');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('store_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'currency_code',
                'currency_symbol',
                'language_code',
                'timezone',
            ]);
        });
    }
};
