<?php

use App\Models\Customer;
use App\Models\CustomerLoyaltyTransaction;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutVite();
});

function createTestProduct(array $attributes = []): Product
{
    return Product::query()->create(array_merge([
        'barcode' => 'LOY-' . Str::upper(Str::random(8)),
        'name' => 'Loyalty Product',
        'stock' => 50,
        'price' => 50.0,
    ], $attributes));
}

function assertLoyaltyConfig(array $overrides = []): void
{
    config()->set('store.loyalty', array_merge([
        'points_per_currency' => 1.0,
        'currency_per_point' => 0.1,
        'minimum_redeemable_points' => 100,
        'earning_rounding' => 'down',
    ], $overrides));
}

it('awards loyalty points and records audit entries', function () {
    assertLoyaltyConfig([
        'points_per_currency' => 1.0,
        'currency_per_point' => 0.1,
        'minimum_redeemable_points' => 50,
        'earning_rounding' => 'down',
    ]);

    $user = User::factory()->create();
    $customer = Customer::factory()->create(['loyalty_points' => 0]);
    $product = createTestProduct(['price' => 100, 'stock' => 10]);

    $response = $this->actingAs($user)->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'customer_id' => $customer->id,
        'payment_method' => 'cash',
        'amount_paid' => 150,
    ]);

    $response->assertRedirect(route('transactions.employee'));

    $customer->refresh();
    $transaction = Transaction::query()->latest()->first();

    expect($transaction)->not->toBeNull();
    expect($customer->loyalty_points)->toBe(111);

    $entries = CustomerLoyaltyTransaction::query()
        ->where('customer_id', $customer->id)
        ->get();

    expect($entries)->toHaveCount(1)
        ->and($entries->first()->type)->toBe(CustomerLoyaltyTransaction::TYPE_EARNING)
        ->and($entries->first()->points_change)->toBe(111)
        ->and($entries->first()->points_balance)->toBe(111)
        ->and((float) $transaction->total)->toBe(111.0);
});

it('enforces minimum redemption and available balance limits', function () {
    assertLoyaltyConfig([
        'points_per_currency' => 1.0,
        'currency_per_point' => 0.1,
        'minimum_redeemable_points' => 100,
        'earning_rounding' => 'down',
    ]);

    $user = User::factory()->create();
    $product = createTestProduct();

    $minCustomer = Customer::factory()->create(['loyalty_points' => 90]);
    $capCustomer = Customer::factory()->create(['loyalty_points' => 180]);

    $this->actingAs($user)->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'customer_id' => $minCustomer->id,
        'loyalty_points_to_redeem' => 80,
        'payment_method' => 'card',
        'amount_paid' => 100,
    ])->assertRedirect(route('transactions.employee'));

    $minCustomer->refresh();
    $minTransaction = Transaction::query()
        ->where('customer_id', $minCustomer->id)
        ->latest()
        ->first();

    expect($minTransaction)->not->toBeNull();
    expect($minCustomer->loyalty_points)->toBe(145);

    $minEntries = CustomerLoyaltyTransaction::query()
        ->where('customer_id', $minCustomer->id)
        ->get();

    expect($minEntries)->toHaveCount(1)
        ->and($minEntries->first()->type)->toBe(CustomerLoyaltyTransaction::TYPE_EARNING)
        ->and($minEntries->first()->points_change)->toBe(55)
        ->and((float) $minTransaction->total)->toBe(55.5);

    $this->actingAs($user)->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'customer_id' => $capCustomer->id,
        'loyalty_points_to_redeem' => 300,
        'payment_method' => 'cash',
        'amount_paid' => 50,
    ])->assertRedirect(route('transactions.employee'));

    $capCustomer->refresh();
    $capTransaction = Transaction::query()
        ->where('customer_id', $capCustomer->id)
        ->latest()
        ->first();

    expect($capTransaction)->not->toBeNull();
    expect((float) $capTransaction?->total)->toBe(37.5);
    expect($capCustomer->loyalty_points)->toBe(37);

    $capEntries = CustomerLoyaltyTransaction::query()
        ->where('customer_id', $capCustomer->id)
        ->orderBy('id')
        ->get();

    expect($capEntries)->toHaveCount(2)
        ->and($capEntries->first()->type)->toBe(CustomerLoyaltyTransaction::TYPE_REDEMPTION)
        ->and($capEntries->first()->points_change)->toBe(-180)
        ->and($capEntries->first()->points_balance)->toBe(0)
        ->and((float) $capEntries->first()->amount)->toBe(18.0)
        ->and($capEntries->last()->type)->toBe(CustomerLoyaltyTransaction::TYPE_EARNING)
        ->and($capEntries->last()->points_change)->toBe(37)
        ->and($capEntries->last()->points_balance)->toBe(37);
});

it('rounds earned points according to configuration', function () {
    assertLoyaltyConfig([
        'points_per_currency' => 0.1,
        'currency_per_point' => 0.01,
        'minimum_redeemable_points' => 10,
        'earning_rounding' => 'nearest',
    ]);

    $user = User::factory()->create();
    $customer = Customer::factory()->create(['loyalty_points' => 0]);
    $product = createTestProduct(['stock' => 5]);

    $this->actingAs($user)->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'customer_id' => $customer->id,
        'payment_method' => 'cash',
        'amount_paid' => 100,
    ])->assertRedirect(route('transactions.employee'));

    $customer->refresh();
    $transaction = Transaction::query()
        ->where('customer_id', $customer->id)
        ->latest()
        ->first();

    expect($transaction)->not->toBeNull();
    expect((float) $transaction?->total)->toBe(55.5);
    expect($customer->loyalty_points)->toBe(6);

    $entry = CustomerLoyaltyTransaction::query()
        ->where('customer_id', $customer->id)
        ->first();

    expect($entry)->not->toBeNull()
        ->and($entry?->points_change)->toBe(6);
});
