<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $defaultDays = (int) config('store.dashboard.default_range_days', 14);
        $maxDays = (int) config('store.dashboard.max_range_days', 90);
        $days = (int) max(1, min($maxDays, $request->integer('days', $defaultDays)));
        $cacheMinutes = (int) config('store.dashboard.cache_minutes', 5);
        $cacheKey = sprintf('dashboard:metrics:%d', $days);

        $metrics = Cache::remember(
            $cacheKey,
            now()->addMinutes($cacheMinutes),
            function () use ($days) {
                $end = CarbonImmutable::now()->endOfDay();
                $start = $end->subDays($days - 1)->startOfDay();

                $aggregate = Transaction::query()
                    ->withinPeriod($start, $end)
                    ->selectRaw('SUM(total) as revenue')
                    ->selectRaw('COUNT(*) as transactions')
                    ->selectRaw('SUM(items_count) as items')
                    ->first();

                $revenue = (float) ($aggregate?->revenue ?? 0);
                $transactions = (int) ($aggregate?->transactions ?? 0);
                $items = (int) ($aggregate?->items ?? 0);
                $averageBasket = $transactions > 0 ? round($items / $transactions, 2) : 0.0;

                $dailySales = Transaction::query()
                    ->withinPeriod($start, $end)
                    ->dailyBreakdown()
                    ->get()
                    ->map(static function ($row) {
                        $transactions = (int) $row->transactions;
                        $items = (int) $row->items;

                        return [
                            'date' => $row->date,
                            'revenue' => (float) $row->revenue,
                            'transactions' => $transactions,
                            'items' => $items,
                            'averageBasketSize' => $transactions > 0
                                ? round($items / $transactions, 2)
                                : 0.0,
                        ];
                    })
                    ->values()
                    ->all();

                $topSelling = TransactionItem::query()
                    ->whereHas('transaction', static function ($query) use ($start, $end) {
                        $query->withinPeriod($start, $end);
                    })
                    ->topSelling()
                    ->get()
                    ->map(static function ($row) {
                        return [
                            'name' => $row->name,
                            'quantity' => (int) $row->quantity,
                            'revenue' => (float) $row->revenue,
                        ];
                    })
                    ->values()
                    ->all();

                $defaultReorderPoint = (int) config('store.inventory.low_stock_threshold', 10);

                $lowStockQuery = Product::query()->belowReorderPoint($defaultReorderPoint);
                $lowStockCount = (clone $lowStockQuery)->count();

                $lowStockProducts = (clone $lowStockQuery)
                    ->select(['id', 'name', 'stock', 'reorder_point', 'reorder_quantity'])
                    ->orderBy('stock')
                    ->orderBy('name')
                    ->limit(5)
                    ->get()
                    ->map(static function (Product $product) use ($defaultReorderPoint) {
                        return [
                            'id' => $product->id,
                            'name' => $product->name,
                            'stock' => $product->stock,
                            'reorderPoint' => $product->reorder_point,
                            'effectiveReorderPoint' => $product->effectiveReorderPoint($defaultReorderPoint),
                            'reorderQuantity' => $product->reorder_quantity,
                        ];
                    })
                    ->values()
                    ->all();

                $customReorderCount = Product::query()->whereNotNull('reorder_point')->count();

                return [
                    'totals' => [
                        'revenue' => $revenue,
                        'transactions' => $transactions,
                        'itemsSold' => $items,
                        'averageBasketSize' => $averageBasket,
                        'lowStockCount' => $lowStockCount,
                    ],
                    'dailySales' => $dailySales,
                    'topSelling' => $topSelling,
                    'lowStockThreshold' => $defaultReorderPoint,
                    'customReorderCount' => $customReorderCount,
                    'lowStockProducts' => $lowStockProducts,
                    'currency' => config('app.currency', 'IDR'),
                    'lastUpdated' => CarbonImmutable::now()->toIso8601String(),
                    'range' => [
                        'start' => $start->toDateString(),
                        'end' => $end->toDateString(),
                        'days' => $days,
                    ],
                ];
            }
        );

        return Inertia::render('dashboard', [
            'metrics' => $metrics,
        ]);
    }
}
