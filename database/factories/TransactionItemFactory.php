<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TransactionItem>
 */
class TransactionItemFactory extends Factory
{
    protected $model = TransactionItem::class;

    public function definition(): array
    {
        $quantity = $this->faker->numberBetween(1, 5);
        $unitCost = $this->faker->randomFloat(2, 5000, 50000);
        $unitPrice = $unitCost + $this->faker->randomFloat(2, 500, 15000);
        $lineTotal = round($unitPrice * $quantity, 2);
        $lineCost = round($unitCost * $quantity, 2);
        $taxRate = 11.0;
        $taxAmount = round($lineTotal * ($taxRate / 100), 2);

        return [
            'transaction_id' => Transaction::factory(),
            'product_id' => Product::factory(),
            'barcode' => $this->faker->unique()->ean13(),
            'name' => $this->faker->words(3, true),
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'unit_cost' => $unitCost,
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'line_total' => $lineTotal,
            'line_cost' => $lineCost,
        ];
    }
}
