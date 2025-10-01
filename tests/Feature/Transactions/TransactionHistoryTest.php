<?php

use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function createTransactionRecord(?User $cashier, Carbon $createdAt, float $subtotal, float $taxTotal, float $total, int $items): Transaction
{
    $transaction = Transaction::query()->create([
        'number' => sprintf('TRX-%s', Str::upper(Str::random(8))),
        'user_id' => $cashier?->id,
        'items_count' => $items,
        'ppn_rate' => 11.0,
        'subtotal' => $subtotal,
        'tax_total' => $taxTotal,
        'total' => $total,
    ]);

    Transaction::withoutTimestamps(function () use ($transaction, $createdAt): void {
        $transaction->forceFill([
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ])->save();
    });

    return $transaction->fresh();
}

beforeEach(function (): void {
    $this->withoutVite();
});

test('guests cannot access transaction history', function () {
    $this->get(route('transactions.history'))->assertRedirect(route('login'));
});

test('authorized users can view transaction history overview', function () {
    $user = User::factory()->create();
    $cashierA = User::factory()->create(['name' => 'Kasir A']);
    $cashierB = User::factory()->create(['name' => 'Kasir B']);

    $first = createTransactionRecord(
        $cashierA,
        Carbon::now()->subDay(),
        subtotal: 150.0,
        taxTotal: 15.0,
        total: 165.0,
        items: 4,
    );

    $second = createTransactionRecord(
        $cashierB,
        Carbon::now(),
        subtotal: 200.0,
        taxTotal: 20.0,
        total: 220.0,
        items: 6,
    );

    $this->actingAs($user)
        ->get(route('transactions.history'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('transactions/history')
            ->where('filters.start_date', null)
            ->has('transactions.data', 2)
            ->where('transactions.data', function ($items) use ($first, $second) {
                $ids = collect($items)->pluck('id')->sort()->values()->all();

                return $ids === collect([$first->id, $second->id])->sort()->values()->all();
            })
            ->where('summary.transactions', 2)
            ->where('summary.total', 385)
            ->has('cashiers', 3) // includes the acting user in the selectable cashiers
        );
});

test('filters restrict the transaction history results', function () {
    $viewer = User::factory()->create();
    $cashier = User::factory()->create(['name' => 'Cashier Filtered']);
    $otherCashier = User::factory()->create();

    createTransactionRecord(
        $cashier,
        Carbon::parse('2024-01-05 10:00:00'),
        subtotal: 120.0,
        taxTotal: 12.0,
        total: 132.0,
        items: 3,
    );

    $matching = createTransactionRecord(
        $cashier,
        Carbon::parse('2024-01-15 09:30:00'),
        subtotal: 180.0,
        taxTotal: 18.0,
        total: 198.0,
        items: 5,
    );

    createTransactionRecord(
        $otherCashier,
        Carbon::parse('2024-02-01 08:00:00'),
        subtotal: 250.0,
        taxTotal: 25.0,
        total: 275.0,
        items: 7,
    );

    $this->actingAs($viewer)
        ->get(route('transactions.history', [
            'start_date' => '2024-01-10',
            'end_date' => '2024-01-20',
            'cashier_id' => $cashier->id,
            'min_total' => 150,
            'max_total' => 220,
        ]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('transactions/history')
            ->where('filters.start_date', '2024-01-10')
            ->where('filters.end_date', '2024-01-20')
            ->where('filters.cashier_id', $cashier->id)
            ->where('filters.min_total', 150)
            ->where('filters.max_total', 220)
            ->has('transactions.data', 1, fn (Assert $item) => $item
                ->where('id', $matching->id)
                ->where('total', fn ($value) => (float) $value === 198.0)
                ->etc()
            )
            ->where('summary.transactions', 1)
            ->where('summary.total', fn ($value) => (float) $value === 198.0)
            ->has('daily', 1, fn (Assert $day) => $day
                ->where('revenue', fn ($value) => (float) $value === 198.0)
                ->where('transactions', 1)
                ->etc()
            )
        );
});
