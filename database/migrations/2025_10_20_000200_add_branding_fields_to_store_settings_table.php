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
            $table->string('store_name')->nullable()->after('ppn_rate');
            $table->text('contact_details')->nullable()->after('store_name');
            $table->string('logo_path')->nullable()->after('contact_details');
            $table->text('receipt_footer_text')->nullable()->after('logo_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('store_settings', function (Blueprint $table): void {
            $table->dropColumn([
                'store_name',
                'contact_details',
                'logo_path',
                'receipt_footer_text',
            ]);
        });
    }
};
