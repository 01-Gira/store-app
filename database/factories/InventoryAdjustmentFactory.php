<?php

namespace Database\Factories;

use App\Models\InventoryAdjustment;
use App\Models\InventoryLocation;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryAdjustment>
 */
class InventoryAdjustmentFactory extends Factory
{
    protected $model = InventoryAdjustment::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'inventory_location_id' => InventoryLocation::factory(),
            'user_id' => User::factory(),
            'quantity_delta' => $this->faker->numberBetween(-10, 15),
            'reason' => $this->faker->randomElement([
                'Cycle Count',
                'Damage',
                'Shrinkage',
                'Manual Correction',
            ]),
            'notes' => $this->faker->optional()->sentence(),
        ];
    }
}
