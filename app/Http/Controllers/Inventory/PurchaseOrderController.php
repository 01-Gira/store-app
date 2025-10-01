<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\ReceivePurchaseOrderRequest;
use App\Http\Requests\Inventory\StorePurchaseOrderRequest;
use App\Http\Requests\Inventory\UpdatePurchaseOrderRequest;
use App\Models\InventoryLevel;
use App\Models\InventoryLocation;
use App\Models\Product;
use App\Models\ProductLot;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PurchaseOrderController extends Controller
{
    public function index(): Response
    {
        $defaultReorderPoint = (int) config('store.inventory.low_stock_threshold', 0);

        $purchaseOrders = PurchaseOrder::query()
            ->with(['supplier', 'items.product'])
            ->latest()
            ->get()
            ->map(function (PurchaseOrder $order): array {
                return [
                    'id' => $order->id,
                    'reference' => $order->reference,
                    'status' => $order->status,
                    'expected_date' => $order->expected_date?->toDateString(),
                    'ordered_at' => $order->ordered_at?->toISOString(),
                    'received_at' => $order->received_at?->toISOString(),
                    'total_cost' => $order->total_cost,
                    'notes' => $order->notes,
                    'is_receivable' => $order->isReceivable(),
                    'supplier' => $order->supplier ? [
                        'id' => $order->supplier->id,
                        'name' => $order->supplier->name,
                    ] : null,
                    'items' => $order->items->map(function (PurchaseOrderItem $item): array {
                        return [
                            'id' => $item->id,
                            'product' => [
                                'id' => $item->product->id,
                                'name' => $item->product->name,
                                'barcode' => $item->product->barcode,
                            ],
                            'quantity_ordered' => $item->quantity_ordered,
                            'quantity_received' => $item->quantity_received,
                            'unit_cost' => $item->unit_cost,
                            'notes' => $item->notes,
                            'is_fulfilled' => $item->isFulfilled(),
                        ];
                    })->all(),
                ];
            });

        $lowStockProducts = Product::query()
            ->with('supplier')
            ->get()
            ->filter(fn (Product $product): bool => $product->isBelowReorderPoint($defaultReorderPoint));

        $suggestions = $lowStockProducts
            ->groupBy(fn (Product $product) => $product->supplier?->id ?? 'unassigned')
            ->map(function ($products) use ($defaultReorderPoint): array {
                /** @var Product $first */
                $first = $products->first();
                $supplier = $first?->supplier;

                return [
                    'supplier' => $supplier ? [
                        'id' => $supplier->id,
                        'name' => $supplier->name,
                        'lead_time_days' => $supplier->lead_time_days,
                    ] : null,
                    'products' => $products->map(function (Product $product) use ($defaultReorderPoint): array {
                        $recommended = $product->reorder_quantity
                            ?? max($product->effectiveReorderPoint($defaultReorderPoint) - $product->stock, 1);

                        if ($recommended <= 0) {
                            $recommended = 1;
                        }

                        return [
                            'id' => $product->id,
                            'name' => $product->name,
                            'barcode' => $product->barcode,
                            'current_stock' => $product->stock,
                            'reorder_point' => $product->effectiveReorderPoint($defaultReorderPoint),
                            'reorder_quantity' => $product->reorder_quantity,
                            'suggested_quantity' => $recommended,
                            'cost_price' => $product->cost_price,
                        ];
                    })->values()->all(),
                ];
            })
            ->values();

        $inventoryLocations = InventoryLocation::query()
            ->orderBy('name')
            ->get()
            ->map(fn (InventoryLocation $location): array => [
                'id' => $location->id,
                'name' => $location->name,
                'code' => $location->code,
                'is_default' => $location->is_default,
            ]);

        return Inertia::render('inventory/purchase-orders/index', [
            'purchaseOrders' => $purchaseOrders,
            'suggestions' => $suggestions,
            'inventoryLocations' => $inventoryLocations,
            'defaultReorderPoint' => $defaultReorderPoint,
        ]);
    }

    public function store(StorePurchaseOrderRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $reference = 'PO-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(4));

        $purchaseOrder = PurchaseOrder::create([
            'reference' => $reference,
            'supplier_id' => $data['supplier_id'],
            'status' => PurchaseOrder::STATUS_ORDERED,
            'expected_date' => $data['expected_date'] ?? null,
            'ordered_at' => now(),
            'notes' => $data['notes'] ?? null,
        ]);

        $totalCost = 0;

        foreach ($data['items'] as $itemData) {
            $product = Product::find($itemData['product_id']);

            if (! $product) {
                continue;
            }

            $unitCostRaw = $itemData['unit_cost'] ?? null;
            $unitCost = $unitCostRaw !== null && $unitCostRaw !== ''
                ? (float) $unitCostRaw
                : (float) ($product->cost_price ?? 0);
            $quantity = (int) $itemData['quantity'];

            $purchaseOrder->items()->create([
                'product_id' => $product->id,
                'quantity_ordered' => $quantity,
                'unit_cost' => $unitCost,
                'notes' => $itemData['notes'] ?? null,
            ]);

            $totalCost += $unitCost * $quantity;
        }

        $purchaseOrder->update(['total_cost' => $totalCost]);

        return Redirect::route('inventory.purchase-orders.index')
            ->with('success', 'Purchase order created successfully.');
    }

    public function update(UpdatePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder): RedirectResponse
    {
        $purchaseOrder->update($request->validated());

        return Redirect::back()->with('success', 'Purchase order updated successfully.');
    }

    public function destroy(PurchaseOrder $purchaseOrder): RedirectResponse
    {
        if ($purchaseOrder->status === PurchaseOrder::STATUS_RECEIVED) {
            return Redirect::back()->with('error', 'Received purchase orders cannot be deleted.');
        }

        $purchaseOrder->items()->delete();
        $purchaseOrder->delete();

        return Redirect::back()->with('success', 'Purchase order deleted successfully.');
    }

    public function receive(ReceivePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder): RedirectResponse
    {
        $data = $request->validated();
        $locationId = (int) $data['location_id'];

        $receivedAny = false;

        DB::transaction(function () use ($data, $purchaseOrder, $locationId, &$receivedAny): void {
            foreach ($data['items'] as $itemPayload) {
                /** @var PurchaseOrderItem|null $item */
                $item = $purchaseOrder->items()->whereKey($itemPayload['id'])->first();

                if (! $item) {
                    continue;
                }

                $remaining = max($item->quantity_ordered - $item->quantity_received, 0);
                $requested = (int) $itemPayload['quantity_received'];
                $receiveQuantity = min($remaining, max($requested, 0));

                if ($receiveQuantity <= 0) {
                    continue;
                }

                $item->quantity_received += $receiveQuantity;
                $item->save();

                $product = $item->product;
                $product->increment('stock', $receiveQuantity);

                $level = InventoryLevel::firstOrNew([
                    'product_id' => $product->id,
                    'inventory_location_id' => $locationId,
                ]);
                $level->quantity = ($level->quantity ?? 0) + $receiveQuantity;
                $level->save();

                $lotNumber = $itemPayload['lot_number']
                    ?? sprintf('%s-%s', $purchaseOrder->reference, $item->id);

                $lot = ProductLot::firstOrNew([
                    'product_id' => $product->id,
                    'inventory_location_id' => $locationId,
                    'lot_number' => $lotNumber,
                ]);

                $lot->purchase_order_item_id = $item->id;
                $lot->quantity = ($lot->quantity ?? 0) + $receiveQuantity;
                $lot->received_at = $lot->received_at ?? now();

                if (! empty($itemPayload['expires_at'])) {
                    $lot->expires_at = $itemPayload['expires_at'];
                }

                $lot->save();

                $receivedAny = true;
            }
        });

        if (! $receivedAny) {
            return Redirect::back()->with('error', 'No items were received for this purchase order.');
        }

        $hasOpenItems = $purchaseOrder->items()
            ->whereColumn('quantity_received', '<', 'quantity_ordered')
            ->exists();

        $purchaseOrder->status = $hasOpenItems
            ? PurchaseOrder::STATUS_PARTIAL
            : PurchaseOrder::STATUS_RECEIVED;
        $purchaseOrder->received_at = $hasOpenItems ? null : now();
        $purchaseOrder->save();

        return Redirect::back()->with('success', 'Purchase order received successfully.');
    }
}
