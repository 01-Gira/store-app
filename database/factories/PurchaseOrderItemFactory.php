<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseOrderItem>
 */
class PurchaseOrderItemFactory extends Factory
{
    protected $model = PurchaseOrderItem::class;

    public function definition(): array
    {
        $quantityOrdered = $this->faker->numberBetween(5, 30);
        $quantityReceived = $this->faker->numberBetween(0, $quantityOrdered);

        return [
            'purchase_order_id' => PurchaseOrder::factory(),
            'product_id' => Product::factory(),
            'quantity_ordered' => $quantityOrdered,
            'quantity_received' => $quantityReceived,
            'unit_cost' => $this->faker->randomFloat(2, 5000, 50000),
            'notes' => $this->faker->optional()->sentence(),
        ];
    }
}
