<?php

namespace Database\Factories;

use App\Models\InventoryLocation;
use App\Models\Product;
use App\Models\ProductLot;
use App\Models\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ProductLot>
 */
class ProductLotFactory extends Factory
{
    protected $model = ProductLot::class;

    public function definition(): array
    {
        $receivedAt = $this->faker->dateTimeBetween('-1 month', 'now');
        $quantity = $this->faker->numberBetween(1, 50);

        return [
            'product_id' => Product::factory(),
            'inventory_location_id' => InventoryLocation::factory(),
            'purchase_order_item_id' => PurchaseOrderItem::factory(),
            'lot_number' => Str::upper($this->faker->bothify('LOT-#####')),
            'quantity' => $quantity,
            'received_at' => $receivedAt,
            'expires_at' => $this->faker->boolean(40)
                ? $this->faker->dateTimeBetween('+1 month', '+1 year')
                : null,
        ];
    }
}
