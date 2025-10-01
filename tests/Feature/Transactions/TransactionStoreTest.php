<?php

use App\Models\Customer;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutVite();
});

function createProduct(array $attributes = []): Product
{
    return Product::query()->create(array_merge([
        'barcode' => 'PRD-' . Str::upper(Str::random(8)),
        'name' => 'Test Product',
        'stock' => 50,
        'price' => 100.0,
    ], $attributes));
}

test('employee can store a transaction with a percentage discount', function () {
    $user = User::factory()->create();
    $product = createProduct(['stock' => 10, 'price' => 100]);

    $response = $this->actingAs($user)->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 2],
        ],
        'discount_type' => 'percentage',
        'discount_value' => 10,
        'payment_method' => 'cash',
        'amount_paid' => 200,
        'notes' => 'Customer birthday discount',
    ]);

    $response->assertRedirect(route('transactions.employee'));

    $transaction = Transaction::query()->with('items')->latest()->first();
    expect($transaction)->not->toBeNull();

    expect((float) $transaction->subtotal)->toBe(200.0)
        ->and((float) $transaction->tax_total)->toBe(22.0)
        ->and((float) $transaction->discount_total)->toBe(22.2)
        ->and((float) $transaction->total)->toBe(199.8)
        ->and($transaction->payment_method)->toBe('cash')
        ->and((float) $transaction->amount_paid)->toBe(200.0)
        ->and((float) $transaction->change_due)->toBe(0.2)
        ->and($transaction->notes)->toBe('Customer birthday discount');

    expect($transaction->items)->toHaveCount(1);
    expect($transaction->items->first()->quantity)->toBe(2);
    expect($product->fresh()->stock)->toBe(8);
});

test('fixed discounts are capped at the transaction total and change is recorded', function () {
    $user = User::factory()->create();
    $product = createProduct(['stock' => 5, 'price' => 50]);

    $response = $this->actingAs($user)->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'discount_type' => 'value',
        'discount_value' => 100,
        'payment_method' => 'card',
        'amount_paid' => 0,
    ]);

    $response->assertRedirect(route('transactions.employee'));

    $transaction = Transaction::query()->latest()->first();
    expect($transaction)->not->toBeNull();

    $grossTotal = 50 + 5.5; // subtotal + tax at 11%

    expect((float) $transaction->discount_total)->toBe(round($grossTotal, 2))
        ->and((float) $transaction->total)->toBe(0.0)
        ->and((float) $transaction->amount_paid)->toBe(0.0)
        ->and((float) $transaction->change_due)->toBe(0.0)
        ->and($transaction->payment_method)->toBe('card');
});

test('amount paid must cover the total due', function () {
    $user = User::factory()->create();
    $product = createProduct(['stock' => 3, 'price' => 75]);

    $response = $this->actingAs($user)->from(route('transactions.employee'))->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'payment_method' => 'cash',
        'amount_paid' => 20,
    ]);

    $response->assertRedirect(route('transactions.employee'))
        ->assertSessionHasErrors(['amount_paid']);

    expect(Transaction::count())->toBe(0);
    expect($product->fresh()->stock)->toBe(3);
});

test('discount values require a matching type', function () {
    $user = User::factory()->create();
    $product = createProduct(['stock' => 4, 'price' => 60]);

    $response = $this->actingAs($user)->from(route('transactions.employee'))->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'discount_value' => 10,
        'payment_method' => 'other',
        'amount_paid' => 100,
    ]);

    $response->assertRedirect(route('transactions.employee'))
        ->assertSessionHasErrors(['discount_type']);

    expect(Transaction::count())->toBe(0);
});

test('transactions may be associated with a customer', function () {
    $user = User::factory()->create();
    $customer = Customer::factory()->create();
    $product = createProduct(['stock' => 2, 'price' => 150]);

    $response = $this->actingAs($user)->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'customer_id' => $customer->id,
        'payment_method' => 'cash',
        'amount_paid' => 200,
    ]);

    $response->assertRedirect(route('transactions.employee'));

    $transaction = Transaction::query()->latest()->first();

    expect($transaction)
        ->not->toBeNull()
        ->and($transaction?->customer_id)->toBe($customer->id)
        ->and($transaction?->customer?->is($customer))->toBeTrue();
});

test('percentage discounts cannot exceed 100 percent', function () {
    $user = User::factory()->create();
    $product = createProduct(['stock' => 6, 'price' => 80]);

    $response = $this->actingAs($user)->from(route('transactions.employee'))->post(route('transactions.store'), [
        'items' => [
            ['product_id' => $product->id, 'quantity' => 1],
        ],
        'discount_type' => 'percentage',
        'discount_value' => 150,
        'payment_method' => 'cash',
        'amount_paid' => 500,
    ]);

    $response->assertRedirect(route('transactions.employee'))
        ->assertSessionHasErrors(['discount_value']);

    expect(Transaction::count())->toBe(0);
});
