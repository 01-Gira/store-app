<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $cost = $this->faker->randomFloat(2, 1000, 50000);

        return [
            'supplier_id' => Supplier::factory(),
            'barcode' => $this->faker->unique()->ean13(),
            'supplier_sku' => strtoupper(Str::random(8)),
            'name' => $this->faker->words(3, true),
            'stock' => $this->faker->numberBetween(0, 50),
            'price' => $cost + $this->faker->randomFloat(2, 500, 5000),
            'cost_price' => $cost,
            'image_path' => null,
            'reorder_point' => null,
            'reorder_quantity' => null,
        ];
    }
}
