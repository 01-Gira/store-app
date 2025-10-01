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
                    ->selectRaw('SUM(subtotal) as subtotal')
                    ->selectRaw('SUM(tax_total) as tax_total')
                    ->selectRaw('SUM(discount_total) as discount_total')
                    ->selectRaw('COUNT(*) as transactions')
                    ->selectRaw('SUM(items_count) as items')
                    ->selectRaw('SUM(CASE WHEN tax_total > 0 THEN 1 ELSE 0 END) as taxed_transactions')
                    ->first();

                $revenue = (float) ($aggregate?->revenue ?? 0);
                $transactions = (int) ($aggregate?->transactions ?? 0);
                $items = (int) ($aggregate?->items ?? 0);
                $subtotal = (float) ($aggregate?->subtotal ?? 0);
                $taxTotal = (float) ($aggregate?->tax_total ?? 0);
                $discountTotal = (float) ($aggregate?->discount_total ?? 0);
                $taxedTransactions = (int) ($aggregate?->taxed_transactions ?? 0);

                $averageBasket = $transactions > 0 ? round($items / $transactions, 2) : 0.0;

                $itemCostAggregate = TransactionItem::query()
                    ->whereHas('transaction', static function ($query) use ($start, $end): void {
                        $query->withinPeriod($start, $end);
                    })
                    ->selectRaw('COALESCE(SUM(line_cost), 0) as cost')
                    ->first();

                $totalCost = (float) ($itemCostAggregate?->cost ?? 0.0);
                $grossProfit = round($revenue - $totalCost, 2);
                $grossMargin = $revenue > 0 ? round($grossProfit / $revenue, 4) : 0.0;

                $itemCostsSubquery = TransactionItem::query()
                    ->selectRaw('transaction_id, COALESCE(SUM(line_cost), 0) as total_cost')
                    ->groupBy('transaction_id');

                $dailySales = Transaction::query()
                    ->withinPeriod($start, $end)
                    ->leftJoinSub($itemCostsSubquery, 'item_costs', 'transactions.id', '=', 'item_costs.transaction_id')
                    ->selectRaw('DATE(transactions.created_at) as date')
                    ->selectRaw('SUM(transactions.total) as revenue')
                    ->selectRaw('COUNT(*) as transactions')
                    ->selectRaw('SUM(transactions.items_count) as items')
                    ->selectRaw('COALESCE(SUM(item_costs.total_cost), 0) as cost')
                    ->groupByRaw('DATE(transactions.created_at)')
                    ->orderBy('date')
                    ->get()
                    ->map(static function ($row) {
                        $transactions = (int) $row->transactions;
                        $items = (int) $row->items;
                        $revenue = (float) $row->revenue;
                        $cost = (float) $row->cost;
                        $profit = round($revenue - $cost, 2);

                        return [
                            'date' => $row->date,
                            'revenue' => $revenue,
                            'transactions' => $transactions,
                            'items' => $items,
                            'cost' => $cost,
                            'profit' => $profit,
                            'averageBasketSize' => $transactions > 0
                                ? round($items / $transactions, 2)
                                : 0.0,
                        ];
                    })
                    ->values()
                    ->all();

                $topSelling = TransactionItem::query()
                    ->whereHas('transaction', static function ($query) use ($start, $end): void {
                        $query->withinPeriod($start, $end);
                    })
                    ->topSelling()
                    ->get()
                    ->map(static function ($row) {
                        $revenue = (float) $row->revenue;
                        $cost = (float) $row->cost;
                        $profit = round($revenue - $cost, 2);
                        $margin = $revenue > 0 ? round($profit / $revenue, 4) : 0.0;

                        return [
                            'name' => $row->name,
                            'quantity' => (int) $row->quantity,
                            'revenue' => $revenue,
                            'cost' => $cost,
                            'profit' => $profit,
                            'profitMargin' => $margin,
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

                $averageDailyRevenue = $days > 0 ? round($revenue / $days, 2) : 0.0;
                $averageDailyProfit = $days > 0 ? round($grossProfit / $days, 2) : 0.0;
                $averageDailyTax = $days > 0 ? round($taxTotal / $days, 2) : 0.0;

                return [
                    'totals' => [
                        'revenue' => $revenue,
                        'transactions' => $transactions,
                        'itemsSold' => $items,
                        'averageBasketSize' => $averageBasket,
                        'lowStockCount' => $lowStockCount,
                        'totalCost' => $totalCost,
                        'grossProfit' => $grossProfit,
                        'grossMargin' => $grossMargin,
                        'taxCollected' => $taxTotal,
                    ],
                    'dailySales' => $dailySales,
                    'topSelling' => $topSelling,
                    'lowStockThreshold' => $defaultReorderPoint,
                    'customReorderCount' => $customReorderCount,
                    'lowStockProducts' => $lowStockProducts,
                    'taxSummary' => [
                        'taxableSales' => $subtotal,
                        'taxCollected' => $taxTotal,
                        'discounts' => $discountTotal,
                        'effectiveTaxRate' => $subtotal > 0 ? round($taxTotal / $subtotal, 4) : 0.0,
                        'transactionsWithTax' => $taxedTransactions,
                        'averageTaxPerTransaction' => $transactions > 0
                            ? round($taxTotal / $transactions, 2)
                            : 0.0,
                    ],
                    'forecast' => [
                        'daysEvaluated' => $days,
                        'averageDailyRevenue' => $averageDailyRevenue,
                        'averageDailyProfit' => $averageDailyProfit,
                        'averageDailyTax' => $averageDailyTax,
                        'projectedRevenue30' => round($averageDailyRevenue * 30, 2),
                        'projectedProfit30' => round($averageDailyProfit * 30, 2),
                        'projectedTax30' => round($averageDailyTax * 30, 2),
                    ],
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
