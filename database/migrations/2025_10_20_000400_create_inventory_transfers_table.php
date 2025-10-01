<?php

use App\Models\InventoryLocation;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_transfers', function (Blueprint $table): void {
            $table->id();
            $table->foreignIdFor(Product::class)->constrained()->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreignId('source_inventory_location_id')
                ->constrained('inventory_locations')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->foreignId('destination_inventory_location_id')
                ->constrained('inventory_locations')
                ->cascadeOnUpdate()
                ->restrictOnDelete();
            $table->foreignIdFor(User::class)->constrained()->cascadeOnUpdate()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_transfers');
    }
};
