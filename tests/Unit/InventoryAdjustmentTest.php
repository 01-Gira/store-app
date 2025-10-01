<?php

use App\Models\InventoryAdjustment;
use App\Models\InventoryLocation;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutVite();
});

function createAdjustmentProduct(array $attributes = []): Product
{
    return Product::query()->create(array_merge([
        'supplier_id' => null,
        'barcode' => 'PRD-' . Str::upper(Str::random(8)),
        'supplier_sku' => null,
        'name' => 'Unit Test Product',
        'stock' => 0,
        'price' => 12.5,
        'cost_price' => 6.0,
        'image_path' => null,
        'reorder_point' => null,
        'reorder_quantity' => null,
    ], $attributes));
}

function createAdjustmentLocation(array $attributes = []): InventoryLocation
{
    return InventoryLocation::query()->create(array_merge([
        'name' => 'Unit Test Location',
        'code' => 'UTL',
        'is_default' => false,
    ], $attributes));
}

test('inventory adjustments expose their related product, location, and user', function (): void {
    $user = User::factory()->create(['name' => 'Auditor']);
    $product = createAdjustmentProduct();
    $location = createAdjustmentLocation();

    $adjustment = InventoryAdjustment::query()->create([
        'product_id' => $product->id,
        'inventory_location_id' => $location->id,
        'user_id' => $user->id,
        'quantity_delta' => '3',
        'reason' => 'Cycle count',
        'notes' => 'Reconciled during audit',
    ]);

    expect($adjustment->product)->toBeInstanceOf(Product::class)
        ->and($adjustment->product->is($product))->toBeTrue()
        ->and($adjustment->inventoryLocation)->toBeInstanceOf(InventoryLocation::class)
        ->and($adjustment->inventoryLocation->is($location))->toBeTrue()
        ->and($adjustment->user)->toBeInstanceOf(User::class)
        ->and($adjustment->user->is($user))->toBeTrue()
        ->and($adjustment->quantity_delta)->toBe(3);
});


