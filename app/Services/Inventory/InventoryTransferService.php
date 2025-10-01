<?php

namespace App\Services\Inventory;

use App\Models\InventoryLevel;
use App\Models\InventoryTransfer;
use Illuminate\Validation\ValidationException;

class InventoryTransferService
{
    /**
     * @throws ValidationException
     */
    public function transfer(int $productId, int $sourceLocationId, int $destinationLocationId, int $quantity, int $userId): InventoryTransfer
    {
        $sourceLevel = InventoryLevel::query()
            ->where('product_id', $productId)
            ->where('inventory_location_id', $sourceLocationId)
            ->lockForUpdate()
            ->first();

        if (! $sourceLevel || $sourceLevel->quantity < $quantity) {
            throw ValidationException::withMessages([
                'quantity' => 'The source location does not have enough on-hand quantity for this transfer.',
            ]);
        }

        $destinationLevel = InventoryLevel::query()
            ->where('product_id', $productId)
            ->where('inventory_location_id', $destinationLocationId)
            ->lockForUpdate()
            ->first();

        if (! $destinationLevel) {
            $destinationLevel = new InventoryLevel();
            $destinationLevel->product_id = $productId;
            $destinationLevel->inventory_location_id = $destinationLocationId;
            $destinationLevel->quantity = 0;
        }

        $sourceLevel->quantity -= $quantity;
        $destinationLevel->quantity += $quantity;

        $sourceLevel->save();
        $destinationLevel->save();

        return InventoryTransfer::query()->create([
            'product_id' => $productId,
            'source_inventory_location_id' => $sourceLocationId,
            'destination_inventory_location_id' => $destinationLocationId,
            'quantity' => $quantity,
            'user_id' => $userId,
        ]);
    }
}
