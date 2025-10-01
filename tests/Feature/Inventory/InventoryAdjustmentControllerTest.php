<?php

use App\Models\InventoryAdjustment;
use App\Models\InventoryLevel;
use App\Models\InventoryLocation;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutVite();
});

function createInventoryLocation(array $attributes = []): InventoryLocation
{
    return InventoryLocation::query()->create(array_merge([
        'name' => 'Main Stockroom',
        'code' => 'MS',
        'is_default' => false,
    ], $attributes));
}

function createInventoryProduct(array $attributes = []): Product
{
    return Product::query()->create(array_merge([
        'supplier_id' => null,
        'barcode' => 'PRD-' . Str::upper(Str::random(8)),
        'supplier_sku' => null,
        'name' => 'Adjustment Test Product',
        'stock' => 0,
        'price' => 10.0,
        'cost_price' => 5.0,
        'image_path' => null,
        'reorder_point' => null,
        'reorder_quantity' => null,
    ], $attributes));
}

test('inventory adjustments index includes locations, products, and audit history', function (): void {
    $user = User::factory()->create();
    $location = createInventoryLocation(['name' => 'Front Store', 'code' => 'FS', 'is_default' => true]);
    $product = createInventoryProduct(['name' => 'Widget A', 'stock' => 12]);

    InventoryLevel::query()->create([
        'product_id' => $product->id,
        'inventory_location_id' => $location->id,
        'quantity' => 6,
    ]);

    $adjustment = InventoryAdjustment::query()->create([
        'product_id' => $product->id,
        'inventory_location_id' => $location->id,
        'user_id' => $user->id,
        'quantity_delta' => -2,
        'reason' => 'Cycle count',
        'notes' => 'Damaged unit removed',
    ]);

    $this->actingAs($user)
        ->get(route('inventory.adjustments.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('inventory/inventory-adjustments/index')
            ->where('inventoryLocations', fn ($locations): bool => collect($locations)->contains(
                fn ($item) => $item['id'] === $location->id
                    && $item['name'] === 'Front Store'
                    && $item['code'] === 'FS'
                    && $item['is_default'] === true,
            ))
            ->has('products', fn (Assert $collection) => $collection
                ->has(0, fn (Assert $productAssert) => $productAssert
                    ->where('id', $product->id)
                    ->where('name', 'Widget A')
                    ->where('stock', 12)
                    ->has('inventory_levels', fn (Assert $levels) => $levels
                        ->has(0, fn (Assert $level) => $level
                            ->where('inventory_location_id', $location->id)
                            ->where('quantity', 6)
                            ->etc()
                        )
                        ->etc()
                    )
                    ->etc()
                )
            )
            ->has('recentAdjustments', fn (Assert $collection) => $collection
                ->has(0, fn (Assert $adjustmentAssert) => $adjustmentAssert
                    ->where('id', $adjustment->id)
                    ->where('quantity_delta', -2)
                    ->where('reason', 'Cycle count')
                    ->where('notes', 'Damaged unit removed')
                    ->where('product.id', $product->id)
                    ->where('location.id', $location->id)
                    ->where('user.id', $user->id)
                    ->etc()
                )
            )
        );
});

test('posting adjustments updates product stock and inventory level', function (): void {
    $user = User::factory()->create();
    $location = createInventoryLocation(['name' => 'Warehouse', 'code' => 'WH']);
    $product = createInventoryProduct(['stock' => 10]);

    InventoryLevel::query()->create([
        'product_id' => $product->id,
        'inventory_location_id' => $location->id,
        'quantity' => 4,
    ]);

    $payload = [
        'location_id' => $location->id,
        'adjustments' => [
            [
                'product_id' => $product->id,
                'quantity_delta' => 5,
                'reason' => 'Cycle count',
                'notes' => 'Overstock discovered',
            ],
            [
                'product_id' => $product->id,
                'quantity_delta' => -2,
                'reason' => 'Damage',
                'notes' => 'Broken packaging',
            ],
        ],
    ];

    $response = $this->actingAs($user)
        ->from(route('inventory.adjustments.index'))
        ->post(route('inventory.adjustments.store'), $payload);

    $response->assertRedirect(route('inventory.adjustments.index'));

    $product->refresh();
    $level = InventoryLevel::query()
        ->where('product_id', $product->id)
        ->where('inventory_location_id', $location->id)
        ->first();

    expect($product->stock)->toBe(13)
        ->and($level)->not->toBeNull()
        ->and($level->quantity)->toBe(7)
        ->and(InventoryAdjustment::count())->toBe(2);

    $entries = InventoryAdjustment::query()->orderBy('id')->get();

    expect($entries->first())->toMatchArray([
        'product_id' => $product->id,
        'inventory_location_id' => $location->id,
        'user_id' => $user->id,
        'quantity_delta' => 5,
        'reason' => 'Cycle count',
        'notes' => 'Overstock discovered',
    ]);

    expect($entries->last())->toMatchArray([
        'quantity_delta' => -2,
        'reason' => 'Damage',
        'notes' => 'Broken packaging',
    ]);
});

