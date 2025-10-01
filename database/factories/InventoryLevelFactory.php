<?php

namespace Database\Factories;

use App\Models\InventoryLevel;
use App\Models\InventoryLocation;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryLevel>
 */
class InventoryLevelFactory extends Factory
{
    protected $model = InventoryLevel::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::factory(),
            'inventory_location_id' => InventoryLocation::factory(),
            'quantity' => $this->faker->numberBetween(0, 75),
        ];
    }
}
