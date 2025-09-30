<?php

namespace App\Http\Controllers\Transactions;

use App\Http\Controllers\Controller;
use App\Http\Requests\Transactions\StoreTransactionRequest;
use App\Models\Product;
use App\Models\StoreSetting;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class TransactionController extends Controller
{
    public function employee(): Response
    {
        $settings = StoreSetting::current();

        return Inertia::render('transactions/employee', [
            'ppnRate' => (float) $settings->ppn_rate,
            'productLookupUrl' => route('transactions.products.show', ['product' => '__BARCODE__']),
            'storeUrl' => route('transactions.store'),
            'recentTransactionId' => session('recentTransactionId'),
            'customerBaseUrl' => route('transactions.customer', ['transaction' => '__ID__']),
            'customerLatestUrl' => route('transactions.customer.latest'),
        ]);
    }

    public function store(StoreTransactionRequest $request): RedirectResponse
    {
        $settings = StoreSetting::current();
        $ppnRate = (float) $settings->ppn_rate;

        $items = collect($request->validated('items'))
            ->map(function (array $item) use ($ppnRate) {
                $product = Product::query()->findOrFail($item['product_id']);
                $quantity = (int) $item['quantity'];

                if ($quantity < 1) {
                    throw ValidationException::withMessages([
                        'items' => 'Each product must have a quantity of at least 1.',
                    ]);
                }

                if ($product->stock < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => "Insufficient stock for {$product->name}.",
                    ]);
                }

                $unitPrice = (float) $product->price;
                $lineSubtotal = round($unitPrice * $quantity, 2);
                $lineTax = round($lineSubtotal * ($ppnRate / 100), 2);
                $lineTotal = round($lineSubtotal + $lineTax, 2);

                return [
                    'product' => $product,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'line_subtotal' => $lineSubtotal,
                    'line_tax' => $lineTax,
                    'line_total' => $lineTotal,
                ];
            });

        if ($items->isEmpty()) {
            throw ValidationException::withMessages([
                'items' => 'Add at least one product before completing the transaction.',
            ]);
        }

        $subtotal = $items->sum('line_subtotal');
        $taxTotal = $items->sum('line_tax');
        $total = $items->sum('line_total');

        $transaction = DB::transaction(function () use ($items, $subtotal, $taxTotal, $total, $ppnRate, $request) {
            $transaction = Transaction::query()->create([
                'number' => $this->generateNumber(),
                'user_id' => $request->user()?->id,
                'items_count' => $items->sum('quantity'),
                'ppn_rate' => $ppnRate,
                'subtotal' => $subtotal,
                'tax_total' => $taxTotal,
                'total' => $total,
            ]);

            $transaction->items()->createMany(
                $items->map(function (array $item) use ($transaction, $ppnRate) {
                    /** @var \App\Models\Product $product */
                    $product = $item['product'];

                    $product->decrement('stock', $item['quantity']);

                    return [
                        'product_id' => $product->id,
                        'barcode' => $product->barcode,
                        'name' => $product->name,
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'],
                        'tax_rate' => $ppnRate,
                        'tax_amount' => $item['line_tax'],
                        'line_total' => $item['line_total'],
                    ];
                })->all(),
            );

            return $transaction;
        });

        return Redirect::route('transactions.employee')
            ->with('success', 'Transaction completed successfully.')
            ->with('recentTransactionId', $transaction->id);
    }

    public function showProduct(Product $product): JsonResponse
    {
        return response()->json([
            'id' => $product->id,
            'barcode' => $product->barcode,
            'name' => $product->name,
            'price' => (float) $product->price,
            'stock' => $product->stock,
        ]);
    }

    public function customer(Transaction $transaction): Response
    {
        $transaction->loadMissing(['items', 'user']);

        return Inertia::render('transactions/customer', [
            'transaction' => $this->formatTransaction($transaction),
            'autoRefresh' => false,
            'latestUrl' => route('transactions.customer.latest'),
        ]);
    }

    public function latest(): Response
    {
        $transaction = Transaction::query()
            ->latest()
            ->with(['items', 'user'])
            ->first();

        return Inertia::render('transactions/customer', [
            'transaction' => $transaction ? $this->formatTransaction($transaction) : null,
            'autoRefresh' => true,
            'latestUrl' => route('transactions.customer.latest'),
        ]);
    }

    protected function formatTransaction(Transaction $transaction): array
    {
        return [
            'id' => $transaction->id,
            'number' => $transaction->number,
            'created_at' => $transaction->created_at?->toIso8601String(),
            'ppn_rate' => (float) $transaction->ppn_rate,
            'subtotal' => (float) $transaction->subtotal,
            'tax_total' => (float) $transaction->tax_total,
            'total' => (float) $transaction->total,
            'items_count' => $transaction->items_count,
            'user' => $transaction->user ? [
                'id' => $transaction->user->id,
                'name' => $transaction->user->name,
            ] : null,
            'items' => $transaction->items
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'barcode' => $item->barcode,
                    'name' => $item->name,
                    'quantity' => $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'tax_rate' => (float) $item->tax_rate,
                    'tax_amount' => (float) $item->tax_amount,
                    'line_total' => (float) $item->line_total,
                ])
                ->toArray(),
        ];
    }

    protected function generateNumber(): string
    {
        $prefix = 'TRX-' . now()->format('Ymd-His');

        return $prefix . '-' . Str::upper(Str::random(4));
    }
}
