<?php

namespace Database\Factories;

use App\Models\PurchaseOrder;
use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @extends Factory<PurchaseOrder>
 */
class PurchaseOrderFactory extends Factory
{
    protected $model = PurchaseOrder::class;

    public function definition(): array
    {
        $orderedAt = Carbon::instance($this->faker->dateTimeBetween('-1 month', '-1 week'));
        $expectedDate = $orderedAt->copy()->addDays($this->faker->numberBetween(3, 14));

        return [
            'reference' => strtoupper(Str::random(10)),
            'supplier_id' => Supplier::factory(),
            'status' => PurchaseOrder::STATUS_ORDERED,
            'expected_date' => $expectedDate->toDateString(),
            'ordered_at' => $orderedAt,
            'received_at' => null,
            'total_cost' => $this->faker->randomFloat(2, 100000, 500000),
            'notes' => $this->faker->optional()->sentence(),
            'created_at' => $orderedAt,
            'updated_at' => $orderedAt,
        ];
    }
}
