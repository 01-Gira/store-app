<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Transaction>
 */
class TransactionFactory extends Factory
{
    protected $model = Transaction::class;

    public function definition(): array
    {
        return [
            'number' => Str::upper($this->faker->bothify('TRX-#####')),
            'user_id' => User::factory(),
            'customer_id' => Customer::factory(),
            'items_count' => 0,
            'ppn_rate' => 11.0,
            'subtotal' => 0,
            'tax_total' => 0,
            'discount_total' => 0,
            'total' => 0,
            'payment_method' => $this->faker->randomElement(['cash', 'credit_card', 'debit_card', 'qris']),
            'amount_paid' => 0,
            'change_due' => 0,
            'notes' => $this->faker->optional()->sentence(),
        ];
    }
}
