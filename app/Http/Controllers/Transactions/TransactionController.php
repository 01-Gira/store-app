<?php

namespace App\Http\Controllers\Transactions;

use App\Http\Controllers\Controller;
use App\Http\Requests\Transactions\StoreTransactionRequest;
use App\Models\Customer;
use App\Models\Product;
use App\Models\StoreSetting;
use App\Models\Transaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
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
            'customerSearchUrl' => route('transactions.customers.index'),
            'customerStoreUrl' => route('transactions.customers.store'),
            'branding' => $this->transformBranding($settings),
        ]);
    }

    public function history(Request $request): Response
    {
        $validated = $request->validate([
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'cashier_id' => ['nullable', 'integer', 'exists:users,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'min_total' => ['nullable', 'numeric', 'min:0'],
            'max_total' => ['nullable', 'numeric', 'min:0', 'gte:min_total'],
        ], [], [
            'cashier_id' => 'cashier',
            'customer_id' => 'customer',
            'min_total' => 'minimum total',
            'max_total' => 'maximum total',
        ]);

        $filters = [
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'cashier_id' => array_key_exists('cashier_id', $validated) && $validated['cashier_id'] !== null
                ? (int) $validated['cashier_id']
                : null,
            'customer_id' => array_key_exists('customer_id', $validated) && $validated['customer_id'] !== null
                ? (int) $validated['customer_id']
                : null,
            'min_total' => array_key_exists('min_total', $validated) && $validated['min_total'] !== null
                ? (float) $validated['min_total']
                : null,
            'max_total' => array_key_exists('max_total', $validated) && $validated['max_total'] !== null
                ? (float) $validated['max_total']
                : null,
        ];

        $transactionsQuery = Transaction::query()->with(['user', 'customer']);
        $this->applyHistoryFilters($transactionsQuery, $filters);

        $transactions = $transactionsQuery
            ->latest('created_at')
            ->paginate(15)
            ->withQueryString()
            ->through(function (Transaction $transaction) {
                return [
                    'id' => $transaction->id,
                    'number' => $transaction->number,
                    'created_at' => $transaction->created_at?->toIso8601String(),
                    'subtotal' => (float) $transaction->subtotal,
                    'tax_total' => (float) $transaction->tax_total,
                    'total' => (float) $transaction->total,
                    'items_count' => $transaction->items_count,
                    'cashier' => $transaction->user ? [
                        'id' => $transaction->user->id,
                        'name' => $transaction->user->name,
                    ] : null,
                    'customer' => $transaction->customer ? [
                        'id' => $transaction->customer->id,
                        'name' => $transaction->customer->name,
                        'email' => $transaction->customer->email,
                        'phone' => $transaction->customer->phone,
                        'loyalty_number' => $transaction->customer->loyalty_number,
                        'loyalty_points' => $transaction->customer->loyalty_points,
                    ] : null,
                    'detail_url' => route('transactions.customer', $transaction),
                ];
            });

        $summaryQuery = Transaction::query();
        $this->applyHistoryFilters($summaryQuery, $filters);

        $summaryResult = $summaryQuery
            ->selectRaw('COUNT(*) as transactions_count')
            ->selectRaw('COALESCE(SUM(subtotal), 0) as subtotal_sum')
            ->selectRaw('COALESCE(SUM(tax_total), 0) as tax_sum')
            ->selectRaw('COALESCE(SUM(total), 0) as total_sum')
            ->selectRaw('COALESCE(SUM(items_count), 0) as items_sum')
            ->first();

        $summary = [
            'transactions' => (int) ($summaryResult?->transactions_count ?? 0),
            'subtotal' => (float) ($summaryResult?->subtotal_sum ?? 0),
            'tax_total' => (float) ($summaryResult?->tax_sum ?? 0),
            'total' => (float) ($summaryResult?->total_sum ?? 0),
            'items' => (int) ($summaryResult?->items_sum ?? 0),
        ];

        $dailyQuery = Transaction::query();
        $this->applyHistoryFilters($dailyQuery, $filters);

        $daily = $dailyQuery
            ->dailyBreakdown()
            ->get()
            ->map(fn ($row) => [
                'date' => Carbon::parse($row->date)->toDateString(),
                'revenue' => (float) $row->revenue,
                'transactions' => (int) $row->transactions,
                'items' => (int) $row->items,
            ])
            ->values();

        $cashiers = User::query()
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
            ])
            ->values();

        $customers = Customer::query()
            ->select(['id', 'name'])
            ->orderBy('name')
            ->get()
            ->map(fn (Customer $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
            ])
            ->values();

        return Inertia::render('transactions/history', [
            'filters' => $filters,
            'transactions' => $transactions,
            'summary' => $summary,
            'daily' => $daily,
            'cashiers' => $cashiers,
            'customers' => $customers,
            'historyUrl' => route('transactions.history'),
            'employeeUrl' => route('transactions.employee'),
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
        $grossTotal = $items->sum('line_total');

        $discountType = $request->validated('discount_type');
        $rawDiscountValue = $request->validated('discount_value');
        $discountValue = $rawDiscountValue !== null ? (float) $rawDiscountValue : null;

        $discountTotal = 0.0;

        if ($discountType === 'percentage' && $discountValue !== null) {
            $discountTotal = round($grossTotal * ($discountValue / 100), 2);
        } elseif ($discountType === 'value' && $discountValue !== null) {
            $discountTotal = round($discountValue, 2);
        }

        if ($discountTotal > $grossTotal) {
            $discountTotal = $grossTotal;
        }

        $total = round(max($grossTotal - $discountTotal, 0), 2);

        $amountPaid = (float) $request->validated('amount_paid');

        if ($amountPaid < $total) {
            throw ValidationException::withMessages([
                'amount_paid' => 'Amount paid must be at least the total due.',
            ]);
        }

        $changeDue = round(max($amountPaid - $total, 0), 2);
        $paymentMethod = $request->validated('payment_method');
        $notes = $request->validated('notes');

        $transaction = DB::transaction(function () use ($items, $subtotal, $taxTotal, $total, $discountTotal, $ppnRate, $request, $amountPaid, $changeDue, $paymentMethod, $notes) {
            $transaction = Transaction::query()->create([
                'number' => $this->generateNumber(),
                'user_id' => $request->user()?->id,
                'customer_id' => $request->validated('customer_id'),
                'items_count' => $items->sum('quantity'),
                'ppn_rate' => $ppnRate,
                'subtotal' => $subtotal,
                'tax_total' => $taxTotal,
                'discount_total' => $discountTotal,
                'total' => $total,
                'payment_method' => $paymentMethod,
                'amount_paid' => $amountPaid,
                'change_due' => $changeDue,
                'notes' => $notes,
            ]);

            $transaction->items()->createMany(
                $items->map(function (array $item) use ($transaction, $ppnRate) {
                    /** @var \App\Models\Product $product */
                    $product = $item['product'];

                    $product->decrement('stock', $item['quantity']);

                    $unitCost = $product->cost_price !== null
                        ? round((float) $product->cost_price, 2)
                        : 0.0;
                    $lineCost = round($unitCost * $item['quantity'], 2);

                    return [
                        'product_id' => $product->id,
                        'barcode' => $product->barcode,
                        'name' => $product->name,
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'],
                        'unit_cost' => $unitCost,
                        'tax_rate' => $ppnRate,
                        'tax_amount' => $item['line_tax'],
                        'line_total' => $item['line_total'],
                        'line_cost' => $lineCost,
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
        $transaction->loadMissing(['items', 'user', 'customer']);
        $settings = StoreSetting::current();

        return Inertia::render('transactions/customer', [
            'transaction' => $this->formatTransaction($transaction),
            'autoRefresh' => false,
            'latestUrl' => route('transactions.customer.latest'),
            'branding' => $this->transformBranding($settings),
        ]);
    }

    public function latest(): Response
    {
        $transaction = Transaction::query()
            ->latest()
            ->with(['items', 'user', 'customer'])
            ->first();
        $settings = StoreSetting::current();

        return Inertia::render('transactions/customer', [
            'transaction' => $transaction ? $this->formatTransaction($transaction) : null,
            'autoRefresh' => true,
            'latestUrl' => route('transactions.customer.latest'),
            'branding' => $this->transformBranding($settings),
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
            'discount_total' => (float) $transaction->discount_total,
            'total' => (float) $transaction->total,
            'items_count' => $transaction->items_count,
            'payment_method' => $transaction->payment_method,
            'amount_paid' => (float) $transaction->amount_paid,
            'change_due' => (float) $transaction->change_due,
            'notes' => $transaction->notes,
            'user' => $transaction->user ? [
                'id' => $transaction->user->id,
                'name' => $transaction->user->name,
            ] : null,
            'customer' => $transaction->customer ? [
                'id' => $transaction->customer->id,
                'name' => $transaction->customer->name,
                'email' => $transaction->customer->email,
                'phone' => $transaction->customer->phone,
                'loyalty_number' => $transaction->customer->loyalty_number,
                'loyalty_points' => $transaction->customer->loyalty_points,
            ] : null,
            'items' => $transaction->items
                ->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'barcode' => $item->barcode,
                    'name' => $item->name,
                    'quantity' => $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'unit_cost' => (float) ($item->unit_cost ?? 0),
                    'tax_rate' => (float) $item->tax_rate,
                    'tax_amount' => (float) $item->tax_amount,
                    'line_total' => (float) $item->line_total,
                    'line_cost' => (float) ($item->line_cost ?? 0),
                    'profit' => (float) $item->line_total - (float) ($item->line_cost ?? 0),
                ])
                ->toArray(),
        ];
    }

    protected function generateNumber(): string
    {
        $prefix = 'TRX-' . now()->format('Ymd-His');

        return $prefix . '-' . Str::upper(Str::random(4));
    }

    protected function transformBranding(StoreSetting $settings): array
    {
        return [
            'store_name' => $settings->store_name,
            'contact_details' => $settings->contact_details,
            'receipt_footer_text' => $settings->receipt_footer_text,
            'logo_url' => $settings->logo_path
                ? Storage::disk('public')->url($settings->logo_path)
                : null,
        ];
    }

    /**
     * @param  array{start_date: string|null, end_date: string|null, cashier_id: int|string|null, customer_id: int|string|null, min_total: float|int|string|null, max_total: float|int|string|null}  $filters
     */
    protected function applyHistoryFilters(Builder $query, array $filters): void
    {
        if (($filters['start_date'] ?? null) !== null && $filters['start_date'] !== '') {
            $start = Carbon::parse($filters['start_date'])->startOfDay();
            $query->where('created_at', '>=', $start);
        }

        if (($filters['end_date'] ?? null) !== null && $filters['end_date'] !== '') {
            $end = Carbon::parse($filters['end_date'])->endOfDay();
            $query->where('created_at', '<=', $end);
        }

        if (($filters['cashier_id'] ?? null) !== null && $filters['cashier_id'] !== '') {
            $query->where('user_id', (int) $filters['cashier_id']);
        }

        if (($filters['customer_id'] ?? null) !== null && $filters['customer_id'] !== '') {
            $query->where('customer_id', (int) $filters['customer_id']);
        }

        if (($filters['min_total'] ?? null) !== null && $filters['min_total'] !== '') {
            $query->where('total', '>=', (float) $filters['min_total']);
        }

        if (($filters['max_total'] ?? null) !== null && $filters['max_total'] !== '') {
            $query->where('total', '<=', (float) $filters['max_total']);
        }
    }
}
