<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StoreInventoryAdjustmentRequest;
use App\Models\InventoryAdjustment;
use App\Models\InventoryLevel;
use App\Models\InventoryLocation;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class InventoryAdjustmentController extends Controller
{
    public function index(): Response
    {
        $inventoryLocations = InventoryLocation::query()
            ->orderBy('name')
            ->get()
            ->map(fn (InventoryLocation $location): array => [
                'id' => $location->id,
                'name' => $location->name,
                'code' => $location->code,
                'is_default' => $location->is_default,
            ]);

        $products = Product::query()
            ->with('inventoryLevels')
            ->orderBy('name')
            ->get()
            ->map(function (Product $product): array {
                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'barcode' => $product->barcode,
                    'stock' => $product->stock,
                    'inventory_levels' => $product->inventoryLevels
                        ->map(fn (InventoryLevel $level): array => [
                            'inventory_location_id' => $level->inventory_location_id,
                            'quantity' => $level->quantity,
                        ])->values()->all(),
                ];
            });

        $adjustments = InventoryAdjustment::query()
            ->with(['product', 'inventoryLocation', 'user'])
            ->latest()
            ->take(50)
            ->get()
            ->map(function (InventoryAdjustment $adjustment): array {
                return [
                    'id' => $adjustment->id,
                    'quantity_delta' => $adjustment->quantity_delta,
                    'reason' => $adjustment->reason,
                    'notes' => $adjustment->notes,
                    'created_at' => $adjustment->created_at?->toIso8601String(),
                    'product' => [
                        'id' => $adjustment->product->id,
                        'name' => $adjustment->product->name,
                        'barcode' => $adjustment->product->barcode,
                        'stock' => $adjustment->product->stock,
                    ],
                    'location' => [
                        'id' => $adjustment->inventoryLocation->id,
                        'name' => $adjustment->inventoryLocation->name,
                        'code' => $adjustment->inventoryLocation->code,
                    ],
                    'user' => [
                        'id' => $adjustment->user->id,
                        'name' => $adjustment->user->name,
                    ],
                ];
            });

        return Inertia::render('inventory/inventory-adjustments/index', [
            'inventoryLocations' => $inventoryLocations,
            'products' => $products,
            'recentAdjustments' => $adjustments,
        ]);
    }

    public function store(StoreInventoryAdjustmentRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        if (! $user) {
            abort(403);
        }

        $userId = (int) $user->id;
        $locationId = (int) $data['location_id'];

        DB::transaction(function () use ($data, $userId, $locationId): void {
            foreach ($data['adjustments'] as $payload) {
                $product = Product::query()
                    ->whereKey($payload['product_id'])
                    ->lockForUpdate()
                    ->first();

                if (! $product) {
                    continue;
                }

                $delta = (int) $payload['quantity_delta'];

                $product->stock = (int) $product->stock + $delta;
                $product->save();

                $level = InventoryLevel::query()
                    ->where('product_id', $product->id)
                    ->where('inventory_location_id', $locationId)
                    ->lockForUpdate()
                    ->first();

                if (! $level) {
                    $level = new InventoryLevel();
                    $level->product_id = $product->id;
                    $level->inventory_location_id = $locationId;
                    $level->quantity = 0;
                }

                $level->quantity = (int) $level->quantity + $delta;
                $level->save();

                $notesRaw = $payload['notes'] ?? null;
                $notes = is_string($notesRaw) ? trim($notesRaw) : null;

                InventoryAdjustment::create([
                    'product_id' => $product->id,
                    'inventory_location_id' => $locationId,
                    'user_id' => $userId,
                    'quantity_delta' => $delta,
                    'reason' => $payload['reason'],
                    'notes' => $notes !== '' ? $notes : null,
                ]);
            }
        });

        return Redirect::back()->with('success', 'Inventory adjustments saved successfully.');
    }
}
