<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        $name = $this->faker->name();

        return [
            'name' => $name,
            'email' => $this->faker->unique()->safeEmail(),
            'phone' => $this->faker->e164PhoneNumber(),
            'loyalty_number' => Str::upper($this->faker->unique->bothify('LOY-####')),
            'loyalty_points' => $this->faker->numberBetween(0, 5000),
            'enrolled_at' => $this->faker->dateTimeBetween('-2 years', 'now'),
            'notes' => $this->faker->boolean(30) ? $this->faker->sentence() : null,
        ];
    }
}
