<?php

use App\Models\InventoryLevel;
use App\Models\InventoryLocation;
use App\Models\InventoryTransfer;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutVite();
});

function createTransferLocation(array $attributes = []): InventoryLocation
{
    return InventoryLocation::query()->create(array_merge([
        'name' => 'Warehouse',
        'code' => Str::upper(Str::random(2)),
        'is_default' => false,
    ], $attributes));
}

function createTransferProduct(array $attributes = []): Product
{
    return Product::query()->create(array_merge([
        'supplier_id' => null,
        'barcode' => 'TRN-' . Str::upper(Str::random(8)),
        'supplier_sku' => null,
        'name' => 'Transfer Test Product',
        'stock' => 0,
        'price' => 10.0,
        'cost_price' => 5.0,
        'image_path' => null,
        'reorder_point' => null,
        'reorder_quantity' => null,
    ], $attributes));
}

it('transfers inventory between locations and records the movement', function (): void {
    $user = User::factory()->create();
    $source = createTransferLocation(['name' => 'Main Warehouse', 'code' => 'WH']);
    $destination = createTransferLocation(['name' => 'Front Store', 'code' => 'FS']);
    $product = createTransferProduct(['stock' => 25]);

    InventoryLevel::query()->create([
        'product_id' => $product->id,
        'inventory_location_id' => $source->id,
        'quantity' => 15,
    ]);

    InventoryLevel::query()->create([
        'product_id' => $product->id,
        'inventory_location_id' => $destination->id,
        'quantity' => 5,
    ]);

    $payload = [
        'source_location_id' => $source->id,
        'destination_location_id' => $destination->id,
        'product_id' => $product->id,
        'quantity' => 7,
    ];

    $response = $this->actingAs($user)
        ->from(route('inventory.transfers.index'))
        ->post(route('inventory.transfers.store'), $payload);

    $response->assertRedirect(route('inventory.transfers.index'));

    $product->refresh();
    $sourceLevel = InventoryLevel::query()
        ->where('product_id', $product->id)
        ->where('inventory_location_id', $source->id)
        ->first();
    $destinationLevel = InventoryLevel::query()
        ->where('product_id', $product->id)
        ->where('inventory_location_id', $destination->id)
        ->first();

    expect($product->stock)->toBe(25)
        ->and($sourceLevel)->not->toBeNull()
        ->and($destinationLevel)->not->toBeNull()
        ->and($sourceLevel->quantity)->toBe(8)
        ->and($destinationLevel->quantity)->toBe(12)
        ->and(InventoryTransfer::count())->toBe(1);

    $transfer = InventoryTransfer::query()->first();

    expect($transfer)->not->toBeNull()
        ->and($transfer->product_id)->toBe($product->id)
        ->and($transfer->source_inventory_location_id)->toBe($source->id)
        ->and($transfer->destination_inventory_location_id)->toBe($destination->id)
        ->and($transfer->quantity)->toBe(7)
        ->and($transfer->user_id)->toBe($user->id);
});

it('rejects transfer attempts that would overdraw the source location', function (): void {
    $user = User::factory()->create();
    $source = createTransferLocation(['name' => 'Overflow Warehouse', 'code' => 'OF']);
    $destination = createTransferLocation(['name' => 'Pop-up Shop', 'code' => 'PS']);
    $product = createTransferProduct(['stock' => 10]);

    InventoryLevel::query()->create([
        'product_id' => $product->id,
        'inventory_location_id' => $source->id,
        'quantity' => 3,
    ]);

    $payload = [
        'source_location_id' => $source->id,
        'destination_location_id' => $destination->id,
        'product_id' => $product->id,
        'quantity' => 5,
    ];

    $response = $this->actingAs($user)
        ->from(route('inventory.transfers.index'))
        ->post(route('inventory.transfers.store'), $payload);

    $response->assertRedirect(route('inventory.transfers.index'))
        ->assertSessionHasErrors(['quantity']);

    $sourceLevel = InventoryLevel::query()
        ->where('product_id', $product->id)
        ->where('inventory_location_id', $source->id)
        ->first();
    $destinationLevel = InventoryLevel::query()
        ->where('product_id', $product->id)
        ->where('inventory_location_id', $destination->id)
        ->first();

    expect($sourceLevel)->not->toBeNull()
        ->and($sourceLevel->quantity)->toBe(3)
        ->and($destinationLevel)->toBeNull()
        ->and(InventoryTransfer::count())->toBe(0);
});
