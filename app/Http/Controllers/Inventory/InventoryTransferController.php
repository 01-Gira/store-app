<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StoreInventoryTransferRequest;
use App\Models\InventoryLevel;
use App\Models\InventoryLocation;
use App\Models\InventoryTransfer;
use App\Models\Product;
use App\Services\Inventory\InventoryTransferService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class InventoryTransferController extends Controller
{
    public function __construct(private readonly InventoryTransferService $transferService)
    {
    }

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

        $transfers = InventoryTransfer::query()
            ->with(['product', 'sourceLocation', 'destinationLocation', 'user'])
            ->latest()
            ->take(50)
            ->get()
            ->map(function (InventoryTransfer $transfer): array {
                return [
                    'id' => $transfer->id,
                    'quantity' => $transfer->quantity,
                    'created_at' => $transfer->created_at?->toIso8601String(),
                    'product' => [
                        'id' => $transfer->product->id,
                        'name' => $transfer->product->name,
                        'barcode' => $transfer->product->barcode,
                    ],
                    'source' => [
                        'id' => $transfer->sourceLocation->id,
                        'name' => $transfer->sourceLocation->name,
                        'code' => $transfer->sourceLocation->code,
                    ],
                    'destination' => [
                        'id' => $transfer->destinationLocation->id,
                        'name' => $transfer->destinationLocation->name,
                        'code' => $transfer->destinationLocation->code,
                    ],
                    'user' => [
                        'id' => $transfer->user->id,
                        'name' => $transfer->user->name,
                    ],
                ];
            });

        return Inertia::render('inventory/transfers/index', [
            'inventoryLocations' => $inventoryLocations,
            'products' => $products,
            'recentTransfers' => $transfers,
        ]);
    }

    public function store(StoreInventoryTransferRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $user = $request->user();

        if (! $user) {
            abort(403);
        }

        DB::transaction(function () use ($data, $user): void {
            $this->transferService->transfer(
                (int) $data['product_id'],
                (int) $data['source_location_id'],
                (int) $data['destination_location_id'],
                (int) $data['quantity'],
                (int) $user->id,
            );
        });

        return Redirect::back()->with('success', 'Inventory transfer recorded successfully.');
    }
}
