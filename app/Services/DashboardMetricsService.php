<?php

namespace App\Services;

use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Transaction;
use App\Models\TransactionItem;
use Carbon\CarbonImmutable;

class DashboardMetricsService
{
    public function build(int $days): array
    {
        $end = CarbonImmutable::now()->endOfDay();
        $start = $end->subDays(max(1, $days) - 1)->startOfDay();

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

        $supplierMetrics = $this->buildSupplierMetrics($start, $end);

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
            'suppliers' => $supplierMetrics,
        ];
    }

    protected function buildSupplierMetrics(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $purchaseOrders = PurchaseOrder::query()
            ->with(['supplier', 'items'])
            ->whereBetween('created_at', [$start, $end])
            ->get();

        $completedOrders = $purchaseOrders->filter(static fn (PurchaseOrder $order) => $order->received_at !== null);
        $onTimeOrders = $completedOrders->filter(static function (PurchaseOrder $order) {
            $variance = $order->schedule_variance_days;

            return $variance !== null && $variance <= 0;
        });

        $totalOrdered = $purchaseOrders->sum(static fn (PurchaseOrder $order) => $order->total_quantity_ordered);
        $totalReceived = $purchaseOrders->sum(static fn (PurchaseOrder $order) => $order->total_quantity_received);

        $allLateDeliveries = $purchaseOrders
            ->filter(static fn (PurchaseOrder $order) => ($order->schedule_variance_days ?? 0) > 0)
            ->values();

        $lateDeliveries = $allLateDeliveries
            ->sortByDesc(static fn (PurchaseOrder $order) => $order->schedule_variance_days ?? 0)
            ->take(5)
            ->values()
            ->map(static function (PurchaseOrder $order) {
                return [
                    'id' => $order->id,
                    'reference' => $order->reference,
                    'supplierName' => $order->supplier?->name,
                    'expectedDate' => $order->expected_date?->toDateString(),
                    'receivedAt' => $order->received_at?->toDateTimeString(),
                    'varianceDays' => $order->schedule_variance_days,
                    'fulfillmentRate' => $order->fulfillment_percentage,
                ];
            })
            ->all();

        $allOutstandingOrders = $purchaseOrders
            ->filter(static fn (PurchaseOrder $order) => $order->outstanding_quantity > 0)
            ->values();

        $outstandingOrders = $allOutstandingOrders
            ->sortByDesc(static fn (PurchaseOrder $order) => $order->outstanding_quantity)
            ->take(5)
            ->values()
            ->map(static function (PurchaseOrder $order) {
                return [
                    'id' => $order->id,
                    'reference' => $order->reference,
                    'supplierName' => $order->supplier?->name,
                    'expectedDate' => $order->expected_date?->toDateString(),
                    'outstandingQuantity' => $order->outstanding_quantity,
                    'fulfillmentRate' => $order->fulfillment_percentage,
                    'status' => $order->status,
                ];
            })
            ->all();

        $supplierGroups = $purchaseOrders
            ->filter(static fn (PurchaseOrder $order) => $order->supplier !== null)
            ->groupBy(static fn (PurchaseOrder $order) => $order->supplier_id);

        $supplierPerformances = $supplierGroups
            ->map(static function ($orders) {
                /** @var \Illuminate\Support\Collection<int, PurchaseOrder> $orders */
                $orders = $orders->values();
                $supplier = $orders->first()->supplier;

                $totalOrders = $orders->count();
                $completed = $orders->filter(static fn (PurchaseOrder $order) => $order->received_at !== null);
                $completedCount = $completed->count();
                $onTimeCount = $completed->filter(static function (PurchaseOrder $order) {
                    $variance = $order->schedule_variance_days;

                    return $variance !== null && $variance <= 0;
                })->count();

                $totalOrdered = $orders->sum(static fn (PurchaseOrder $order) => $order->total_quantity_ordered);
                $totalReceived = $orders->sum(static fn (PurchaseOrder $order) => $order->total_quantity_received);

                $fulfillmentRate = $totalOrdered > 0 ? round($totalReceived / $totalOrdered, 4) : null;
                $onTimeRate = $completedCount > 0 ? round($onTimeCount / $completedCount, 4) : null;
                $averageLeadTime = $completedCount > 0
                    ? round($completed->avg(static fn (PurchaseOrder $order) => $order->actual_lead_time_days ?? 0), 2)
                    : null;
                $averageVariance = $totalOrders > 0
                    ? round($orders->avg(static fn (PurchaseOrder $order) => $order->schedule_variance_days ?? 0), 2)
                    : null;
                $lateDeliveries = $orders
                    ->filter(static fn (PurchaseOrder $order) => ($order->schedule_variance_days ?? 0) > 0)
                    ->count();
                $score = round((($onTimeRate ?? 0) * 0.6) + (($fulfillmentRate ?? 0) * 0.4), 4);

                return [
                    'supplierId' => $supplier?->id,
                    'supplierName' => $supplier?->name,
                    'orders' => $totalOrders,
                    'completedOrders' => $completedCount,
                    'onTimeRate' => $onTimeRate,
                    'averageLeadTime' => $averageLeadTime,
                    'averageVariance' => $averageVariance,
                    'fulfillmentRate' => $fulfillmentRate,
                    'lateDeliveries' => $lateDeliveries,
                    'score' => $score,
                ];
            })
            ->values();

        $summary = [
            'suppliersEvaluated' => $supplierGroups->count(),
            'averageLeadTime' => $completedOrders->count() > 0
                ? round($completedOrders->avg(static fn (PurchaseOrder $order) => $order->actual_lead_time_days ?? 0), 2)
                : null,
            'averageFulfillmentRate' => $totalOrdered > 0
                ? round($totalReceived / $totalOrdered, 4)
                : null,
            'onTimeRate' => $completedOrders->count() > 0
                ? round($onTimeOrders->count() / $completedOrders->count(), 4)
                : null,
            'lateDeliveryCount' => $allLateDeliveries->count(),
            'outstandingCount' => $allOutstandingOrders->count(),
        ];

        return [
            'summary' => $summary,
            'topSuppliers' => $supplierPerformances
                ->sortByDesc(static fn (array $performance) => $performance['score'])
                ->take(5)
                ->values()
                ->all(),
            'lateDeliveries' => $lateDeliveries,
            'outstandingOrders' => $outstandingOrders,
        ];
    }
}
