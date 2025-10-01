<?php

namespace Database\Factories;

use App\Models\InventoryLocation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<InventoryLocation>
 */
class InventoryLocationFactory extends Factory
{
    protected $model = InventoryLocation::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->company() . ' Storage',
            'code' => Str::upper($this->faker->unique()->lexify('LOC??')),
            'is_default' => false,
        ];
    }
}
