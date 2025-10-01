import { TablePagination, TableToolbar } from '@/components/table-controls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTableControls } from '@/hooks/use-table-controls';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    AlertTriangle,
    BarChart3,
    CalendarClock,
    ClipboardList,
    Coins,
    PackageOpen,
    Receipt,
    ShoppingBag,
    Timer,
    TrendingUp,
    Truck,
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Tooltip,
    Legend,
    Filler,
    type ChartOptions,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler);

interface DailySalesSnapshot {
    date: string;
    revenue: number;
    transactions: number;
    items: number;
    averageBasketSize: number;
    cost: number;
    profit: number;
}

interface TopSellingItem {
    name: string;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
    profitMargin: number;
}

interface SupplierSummary {
    suppliersEvaluated: number;
    averageLeadTime: number | null;
    averageFulfillmentRate: number | null;
    onTimeRate: number | null;
    lateDeliveryCount: number;
    outstandingCount: number;
}

interface SupplierPerformance {
    supplierId: number | null;
    supplierName: string | undefined;
    orders: number;
    completedOrders: number;
    onTimeRate: number | null;
    averageLeadTime: number | null;
    averageVariance: number | null;
    fulfillmentRate: number | null;
    lateDeliveries: number;
    score: number;
}

interface SupplierLateDelivery {
    id: number;
    reference: string;
    supplierName?: string;
    expectedDate: string | null;
    receivedAt: string | null;
    varianceDays: number | null;
    fulfillmentRate: number | null;
}

interface SupplierOutstandingOrder {
    id: number;
    reference: string;
    supplierName?: string;
    expectedDate: string | null;
    outstandingQuantity: number;
    fulfillmentRate: number | null;
    status: string;
}

interface SupplierMetrics {
    summary: SupplierSummary;
    topSuppliers: SupplierPerformance[];
    lateDeliveries: SupplierLateDelivery[];
    outstandingOrders: SupplierOutstandingOrder[];
}

interface DashboardMetrics {
    totals: {
        revenue: number;
        transactions: number;
        itemsSold: number;
        averageBasketSize: number;
        lowStockCount: number;
        totalCost: number;
        grossProfit: number;
        grossMargin: number;
        taxCollected: number;
    };
    dailySales: DailySalesSnapshot[];
    topSelling: TopSellingItem[];
    lowStockThreshold: number;
    customReorderCount: number;
    lowStockProducts: {
        id: number;
        name: string;
        stock: number;
        reorderPoint: number | null;
        effectiveReorderPoint: number;
        reorderQuantity: number | null;
    }[];
    taxSummary: {
        taxableSales: number;
        taxCollected: number;
        discounts: number;
        effectiveTaxRate: number;
        transactionsWithTax: number;
        averageTaxPerTransaction: number;
    };
    forecast: {
        daysEvaluated: number;
        averageDailyRevenue: number;
        averageDailyProfit: number;
        averageDailyTax: number;
        projectedRevenue30: number;
        projectedProfit30: number;
        projectedTax30: number;
    };
    currency: string;
    lastUpdated: string;
    range: {
        start: string;
        end: string;
        days: number;
    };
    suppliers: SupplierMetrics;
}

interface DashboardPageProps {
    metrics: DashboardMetrics;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
];

const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('id-ID', options ?? { dateStyle: 'medium' }).format(new Date(value));

const buildSparklinePoints = (values: number[]) => {
    if (values.length === 0) {
        return '';
    }

    if (values.length === 1) {
        return '0,50 100,50';
    }

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    return values
        .map((value, index) => {
            const x = (index / (values.length - 1)) * 100;
            const y = 100 - ((value - min) / range) * 100;
            return `${x},${y}`;
        })
        .join(' ');
};

export default function Dashboard({ metrics }: DashboardPageProps) {
    const dailySales = metrics.dailySales;
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: metrics.currency ?? 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value);
    const formatDecimal = (value: number) =>
        new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value);
    const formatPercent = (value: number) =>
        new Intl.NumberFormat('id-ID', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value);

    const ensureNumber = (value: number | string) => (typeof value === 'string' ? Number(value) : value);
    const hasDailySales = dailySales.length > 0;
    const chartLabels = dailySales.map((day) => formatDate(day.date, { day: 'numeric', month: 'short' }));

    const revenueTrendData = {
        labels: chartLabels,
        datasets: [
            {
                label: 'Pendapatan',
                data: dailySales.map((day) => day.revenue),
                borderColor: 'rgb(99, 102, 241)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                tension: 0.35,
                fill: true,
            },
            {
                label: 'Laba',
                data: dailySales.map((day) => day.profit),
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                tension: 0.35,
                fill: true,
            },
        ],
    };

    const revenueTrendOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index',
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                },
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const value = context.parsed.y ?? 0;
                        const label = context.dataset.label ?? '';

                        return `${label}: ${formatCurrency(value)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
            },
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => formatCurrency(ensureNumber(value)),
                },
            },
        },
    };

    const transactionsBarData = {
        labels: chartLabels,
        datasets: [
            {
                label: 'Transaksi',
                data: dailySales.map((day) => day.transactions),
                backgroundColor: 'rgba(59, 130, 246, 0.85)',
                borderRadius: 6,
                maxBarThickness: 28,
            },
            {
                label: 'Item Terjual',
                data: dailySales.map((day) => day.items),
                backgroundColor: 'rgba(234, 179, 8, 0.85)',
                borderRadius: 6,
                maxBarThickness: 28,
            },
        ],
    };

    const transactionsBarOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                },
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const value = context.parsed.y ?? 0;
                        const label = context.dataset.label ?? '';

                        return `${label}: ${formatNumber(value)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
            },
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => formatNumber(ensureNumber(value)),
                },
            },
        },
    };

    const revenueBreakdownData = {
        labels: ['Laba Kotor', 'PPN Dikumpulkan', 'Biaya Barang'],
        datasets: [
            {
                label: 'Nilai',
                data: [
                    metrics.totals.grossProfit,
                    metrics.totals.taxCollected,
                    metrics.totals.totalCost,
                ],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.85)',
                    'rgba(249, 115, 22, 0.85)',
                    'rgba(59, 130, 246, 0.85)',
                ],
                borderWidth: 0,
                hoverOffset: 8,
            },
        ],
    };

    const revenueBreakdownOptions: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                },
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const label = context.label ?? '';
                        const value = typeof context.parsed === 'number' ? context.parsed : 0;

                        return `${label}: ${formatCurrency(value)}`;
                    },
                },
            },
        },
    };

    const revenueBreakdownTotal =
        ((revenueBreakdownData.datasets[0]?.data as number[] | undefined)?.reduce(
            (sum, value) => sum + value,
            0,
        ) ?? 0);

    const supplierMetrics = metrics.suppliers;
    const supplierSummary = supplierMetrics.summary;
    const formatOptionalPercent = (value: number | null) =>
        value === null ? '—' : formatPercent(value);
    const formatOptionalDays = (value: number | null) =>
        value === null ? '—' : `${value.toFixed(1)} hari`;
    const formatVariance = (value: number | null) => {
        if (value === null) {
            return '—';
        }

        const prefix = value > 0 ? '+' : '';

        return `${prefix}${value.toFixed(1)} hari`;
    };
    const topSupplierControls = useTableControls(supplierMetrics.topSuppliers, {
        searchFields: [
            (supplier) => supplier.supplierName ?? '',
            (supplier) => (supplier.supplierId != null ? supplier.supplierId.toString() : ''),
        ],
        filters: [
            { label: 'Semua skor', value: 'all' },
            {
                label: 'Skor ≥ 85',
                value: 'excellent',
                predicate: (supplier) => supplier.score >= 85,
            },
            {
                label: 'Skor 70 – 84',
                value: 'good',
                predicate: (supplier) => supplier.score >= 70 && supplier.score < 85,
            },
            {
                label: 'Skor < 70',
                value: 'attention',
                predicate: (supplier) => supplier.score < 70,
            },
        ],
        initialPageSize: 5,
    });
    const supplierIssueCount = supplierSummary.lateDeliveryCount + supplierSummary.outstandingCount;

    const periodLabel =
        metrics.range.start === metrics.range.end
            ? formatDate(metrics.range.start)
            : `${formatDate(metrics.range.start)} – ${formatDate(metrics.range.end)}`;

    const lastUpdatedLabel = formatDate(metrics.lastUpdated, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    const averagePoints = buildSparklinePoints(
        dailySales.map((day) => Number.isFinite(day.averageBasketSize) ? day.averageBasketSize : 0),
    );

    const totalDailyRevenue = dailySales.reduce((sum, day) => sum + day.revenue, 0);
    const totalDailyProfit = dailySales.reduce((sum, day) => sum + day.profit, 0);
    const totalDailyTransactions = dailySales.reduce((sum, day) => sum + day.transactions, 0);
    const totalDailyItems = dailySales.reduce((sum, day) => sum + day.items, 0);
    const averageDailyRevenue = hasDailySales ? totalDailyRevenue / dailySales.length : 0;
    const averageDailyProfit = hasDailySales ? totalDailyProfit / dailySales.length : 0;
    const averageDailyTransactions = hasDailySales ? totalDailyTransactions / dailySales.length : 0;
    const averageDailyItems = hasDailySales ? totalDailyItems / dailySales.length : 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />

            <div className="flex flex-1 flex-col gap-6 p-4">
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                                <CardDescription>Selama {metrics.range.days} hari terakhir</CardDescription>
                            </div>
                            <div className="rounded-full bg-primary/10 p-2 text-primary">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatCurrency(metrics.totals.revenue)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Periode {periodLabel}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
                                <CardDescription>Termasuk {formatNumber(metrics.totals.itemsSold)} item</CardDescription>
                            </div>
                            <div className="rounded-full bg-primary/10 p-2 text-primary">
                                <ShoppingBag className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatNumber(metrics.totals.transactions)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Periode {periodLabel}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Rata-rata Item per Keranjang</CardTitle>
                                <CardDescription>Nilai rata-rata transaksi</CardDescription>
                            </div>
                            <div className="rounded-full bg-primary/10 p-2 text-primary">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {metrics.totals.averageBasketSize.toFixed(2)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Diperbarui {lastUpdatedLabel}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Produk Hampir Habis</CardTitle>
                                <CardDescription>
                                    Ambang default &le; {formatNumber(metrics.lowStockThreshold)} unit
                                </CardDescription>
                            </div>
                            <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                                <PackageOpen className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatNumber(metrics.totals.lowStockCount)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Periksa persediaan secara berkala</p>
                            {metrics.customReorderCount > 0 && (
                                <Badge variant="secondary" className="mt-3 w-fit">
                                    {formatNumber(metrics.customReorderCount)} ambang khusus
                                </Badge>
                            )}
                            <div className="mt-3 space-y-2">
                                {metrics.lowStockProducts.length > 0 ? (
                                    metrics.lowStockProducts.map((product) => (
                                        <div
                                            key={product.id}
                                            className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                                        >
                                            <span className="flex-1 truncate text-foreground">
                                                {product.name}
                                            </span>
                                            <div className="text-right">
                                                <span className="font-medium text-foreground">
                                                    {formatNumber(product.stock)} /{' '}
                                                    {formatNumber(product.effectiveReorderPoint)}
                                                </span>
                                                {product.reorderQuantity !== null && (
                                                    <div className="text-[0.65rem] uppercase tracking-wide">
                                                        Reorder {formatNumber(product.reorderQuantity)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground">
                                        Semua produk berada di atas ambang persediaan.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Rata-rata Lead Time Pemasok</CardTitle>
                                <CardDescription>
                                    {formatNumber(supplierSummary.suppliersEvaluated)} pemasok dievaluasi
                                </CardDescription>
                            </div>
                            <div className="rounded-full bg-primary/10 p-2 text-primary">
                                <Timer className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatOptionalDays(supplierSummary.averageLeadTime)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Berbasis pesanan yang telah diterima</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Ketepatan Pengiriman</CardTitle>
                                <CardDescription>Persentase pesanan tiba tepat waktu</CardDescription>
                            </div>
                            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                                <Truck className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatOptionalPercent(supplierSummary.onTimeRate)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Pembaharuan {lastUpdatedLabel}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Tingkat Pemenuhan</CardTitle>
                                <CardDescription>Rata-rata kuantitas diterima</CardDescription>
                            </div>
                            <div className="rounded-full bg-sky-500/10 p-2 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatOptionalPercent(supplierSummary.averageFulfillmentRate)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">Mengukur kuantitas diterima vs dipesan</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Pesanan Bermasalah</CardTitle>
                                <CardDescription>Pesanan terlambat atau outstanding</CardDescription>
                            </div>
                            <div className="rounded-full bg-destructive/10 p-2 text-destructive">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatNumber(supplierIssueCount)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {formatNumber(supplierSummary.lateDeliveryCount)} terlambat •{' '}
                                {formatNumber(supplierSummary.outstandingCount)} outstanding
                            </p>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Laba Kotor</CardTitle>
                                <CardDescription>Perbandingan pendapatan dan biaya barang</CardDescription>
                            </div>
                            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                                <Coins className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatCurrency(metrics.totals.grossProfit)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Margin {formatPercent(metrics.totals.grossMargin)}
                            </p>
                            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                                <div className="flex items-center justify-between">
                                    <span>Biaya barang</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(metrics.totals.totalCost)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>PPN dikumpulkan</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(metrics.totals.taxCollected)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Ringkasan Pajak</CardTitle>
                                <CardDescription>Periode {periodLabel}</CardDescription>
                            </div>
                            <div className="rounded-full bg-amber-500/10 p-2 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200">
                                <Receipt className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatCurrency(metrics.taxSummary.taxCollected)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Tarif efektif {formatPercent(metrics.taxSummary.effectiveTaxRate)}
                            </p>
                            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                                <div className="flex items-center justify-between">
                                    <span>Penjualan kena pajak</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(metrics.taxSummary.taxableSales)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Transaksi kena pajak</span>
                                    <span className="font-medium text-foreground">
                                        {formatNumber(metrics.taxSummary.transactionsWithTax)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>PPN rata-rata / transaksi</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(metrics.taxSummary.averageTaxPerTransaction)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Diskon diterapkan</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(metrics.taxSummary.discounts)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between space-y-0">
                            <div>
                                <CardTitle className="text-sm font-medium">Proyeksi 30 Hari</CardTitle>
                                <CardDescription>Berbasis pada {metrics.forecast.daysEvaluated} hari terakhir</CardDescription>
                            </div>
                            <div className="rounded-full bg-sky-500/10 p-2 text-sky-600 dark:bg-sky-500/20 dark:text-sky-200">
                                <CalendarClock className="h-5 w-5" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-semibold tracking-tight">
                                {formatCurrency(metrics.forecast.projectedRevenue30)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Laba diproyeksikan {formatCurrency(metrics.forecast.projectedProfit30)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                PPN diproyeksikan {formatCurrency(metrics.forecast.projectedTax30)}
                            </p>
                            <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                                <div className="flex items-center justify-between">
                                    <span>Pendapatan harian</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(metrics.forecast.averageDailyRevenue)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Laba harian</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(metrics.forecast.averageDailyProfit)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>PPN harian</span>
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(metrics.forecast.averageDailyTax)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                    <Card className="xl:col-span-2">
                        <CardHeader>
                            <CardTitle>Tren Pendapatan &amp; Laba</CardTitle>
                            <CardDescription>
                                Visualisasi kinerja harian selama periode {periodLabel}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {hasDailySales ? (
                                <div className="space-y-4">
                                    <div className="h-80">
                                        <Line data={revenueTrendData} options={revenueTrendOptions} />
                                    </div>
                                    <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide">Rata-rata pendapatan</p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatCurrency(averageDailyRevenue)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wide">Rata-rata laba</p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatCurrency(averageDailyProfit)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Data harian belum tersedia untuk menampilkan grafik.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Komposisi Pendapatan</CardTitle>
                            <CardDescription>Porsi laba, pajak, dan biaya terhadap pendapatan</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {revenueBreakdownTotal > 0 ? (
                                <>
                                    <div className="h-80">
                                        <Doughnut
                                            data={revenueBreakdownData}
                                            options={revenueBreakdownOptions}
                                        />
                                    </div>
                                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                                        <div className="flex items-center justify-between">
                                            <span>Pendapatan total</span>
                                            <span className="font-medium text-foreground">
                                                {formatCurrency(metrics.totals.revenue)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Laba kotor</span>
                                            <span className="font-medium text-foreground">
                                                {formatCurrency(metrics.totals.grossProfit)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>PPN dikumpulkan</span>
                                            <span className="font-medium text-foreground">
                                                {formatCurrency(metrics.totals.taxCollected)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Biaya barang</span>
                                            <span className="font-medium text-foreground">
                                                {formatCurrency(metrics.totals.totalCost)}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Belum ada data pendapatan untuk menampilkan komposisi.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Pemasok Berkinerja Terbaik</CardTitle>
                            <CardDescription>Diurutkan dari skor gabungan ketepatan dan pemenuhan</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {topSupplierControls.total > 0 ? (
                                <div className="space-y-4">
                                    <TableToolbar
                                        searchTerm={topSupplierControls.searchTerm}
                                        onSearchChange={topSupplierControls.setSearchTerm}
                                        searchPlaceholder="Cari pemasok atau ID pemasok"
                                        filterOptions={topSupplierControls.filterOptions}
                                        filterValue={topSupplierControls.filterValue}
                                        onFilterChange={topSupplierControls.setFilterValue}
                                        pageSize={topSupplierControls.pageSize}
                                        pageSizeOptions={topSupplierControls.pageSizeOptions}
                                        onPageSizeChange={topSupplierControls.setPageSize}
                                        total={topSupplierControls.total}
                                        filteredTotal={topSupplierControls.filteredTotal}
                                    />

                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[480px] text-sm">
                                            <thead className="text-xs uppercase text-muted-foreground">
                                                <tr>
                                                    <th className="px-2 py-2 text-left font-medium">Pemasok</th>
                                                    <th className="px-2 py-2 text-right font-medium">Pesanan</th>
                                                    <th className="px-2 py-2 text-right font-medium">Tepat Waktu</th>
                                                    <th className="px-2 py-2 text-right font-medium">Pemenuhan</th>
                                                    <th className="px-2 py-2 text-right font-medium">Lead Time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {topSupplierControls.filteredTotal === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={5}
                                                            className="px-2 py-6 text-center text-sm text-muted-foreground"
                                                        >
                                                            Tidak ada pemasok yang cocok dengan pencarian atau filter.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    topSupplierControls.items.map((supplier, index) => (
                                                        <tr
                                                            key={`${supplier.supplierId ?? 'unknown'}-${index}`}
                                                            className={index % 2 === 1 ? 'bg-muted/40' : undefined}
                                                        >
                                                            <td className="px-2 py-2 align-top">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-foreground">
                                                                        {supplier.supplierName ?? 'Tidak diketahui'}
                                                                    </span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {formatNumber(supplier.completedOrders)} selesai •{' '}
                                                                        {formatNumber(supplier.lateDeliveries)} terlambat
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2 text-right font-medium text-foreground">
                                                                {formatNumber(supplier.orders)}
                                                            </td>
                                                            <td className="px-2 py-2 text-right">
                                                                {formatOptionalPercent(supplier.onTimeRate)}
                                                            </td>
                                                            <td className="px-2 py-2 text-right">
                                                                {formatOptionalPercent(supplier.fulfillmentRate)}
                                                            </td>
                                                            <td className="px-2 py-2 text-right">
                                                                {formatOptionalDays(supplier.averageLeadTime)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <TablePagination
                                        page={topSupplierControls.page}
                                        pageCount={topSupplierControls.pageCount}
                                        onPageChange={topSupplierControls.goToPage}
                                        range={topSupplierControls.range}
                                        total={topSupplierControls.total}
                                        filteredTotal={topSupplierControls.filteredTotal}
                                    />
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Belum ada data pemasok yang tersedia untuk periode ini.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Pengiriman Terlambat</CardTitle>
                            <CardDescription>Variansi dibanding tanggal yang diharapkan</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {supplierMetrics.lateDeliveries.length > 0 ? (
                                <ul className="space-y-3">
                                    {supplierMetrics.lateDeliveries.map((delivery) => (
                                        <li key={delivery.id} className="rounded-lg border p-3">
                                            <div className="flex items-center justify-between gap-2 text-sm font-medium">
                                                <span className="truncate">{delivery.reference}</span>
                                                <span className="text-xs text-destructive">
                                                    {formatVariance(delivery.varianceDays)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {delivery.supplierName ?? 'Pemasok tidak diketahui'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Estimasi {delivery.expectedDate ? formatDate(delivery.expectedDate) : '—'}
                                                {delivery.receivedAt && (
                                                    <>
                                                        {' '}
                                                        • diterima {formatDate(delivery.receivedAt)}
                                                    </>
                                                )}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Pemenuhan {formatOptionalPercent(delivery.fulfillmentRate)}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Tidak ada pengiriman terlambat pada periode ini.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-3">
                        <CardHeader>
                            <CardTitle>Pesanan Outstanding</CardTitle>
                            <CardDescription>Pesanan yang belum terpenuhi sepenuhnya</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {supplierMetrics.outstandingOrders.length > 0 ? (
                                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {supplierMetrics.outstandingOrders.map((order) => (
                                        <li key={order.id} className="rounded-lg border p-3">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold leading-tight text-foreground">
                                                        {order.reference}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {order.supplierName ?? 'Pemasok tidak diketahui'}
                                                    </p>
                                                </div>
                                                <Badge variant="secondary" className="uppercase">
                                                    {order.status}
                                                </Badge>
                                            </div>
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                Outstanding {formatNumber(order.outstandingQuantity)} unit
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Pemenuhan {formatOptionalPercent(order.fulfillmentRate)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Estimasi {order.expectedDate ? formatDate(order.expectedDate) : '—'}
                                            </p>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Semua pesanan pemasok telah terpenuhi.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Aktivitas Transaksi Harian</CardTitle>
                            <CardDescription>Perbandingan transaksi dan item terjual setiap hari</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {hasDailySales ? (
                                <div className="space-y-6">
                                    <div className="h-72">
                                        <Bar data={transactionsBarData} options={transactionsBarOptions} />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-4">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Pendapatan rata-rata</p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatCurrency(averageDailyRevenue)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Transaksi harian</p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatDecimal(averageDailyTransactions)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Item terjual harian</p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatDecimal(averageDailyItems)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Laba kotor harian</p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatCurrency(averageDailyProfit)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Belum ada transaksi pada periode yang dipilih.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Produk Terlaris</CardTitle>
                            <CardDescription>5 produk dengan penjualan terbaik</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {metrics.topSelling.length > 0 ? (
                                <ul className="space-y-4">
                                    {metrics.topSelling.map((item, index) => (
                                        <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="font-medium leading-none">{item.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatNumber(item.quantity)} unit terjual
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-semibold">{formatCurrency(item.revenue)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    Laba {formatCurrency(item.profit)} • {formatPercent(item.profitMargin)}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Belum ada produk terjual pada periode ini.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Rata-rata Keranjang</CardTitle>
                            <CardDescription>Pergerakan jumlah item rata-rata per transaksi</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dailySales.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="h-40 w-full overflow-hidden">
                                        <svg
                                            className="h-full w-full text-primary"
                                            viewBox="0 0 100 100"
                                            preserveAspectRatio="none"
                                            role="img"
                                            aria-label="Grafik rata-rata keranjang"
                                        >
                                            <polyline
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                                points={averagePoints}
                                            />
                                        </svg>
                                    </div>
                                    <ul className="grid gap-3 sm:grid-cols-3">
                                        {dailySales.slice(-3).map((day) => (
                                            <li key={`avg-${day.date}`} className="rounded-lg border p-3">
                                                <p className="text-xs text-muted-foreground">
                                                    {formatDate(day.date, { weekday: 'short', day: 'numeric' })}
                                                </p>
                                                <p className="text-lg font-semibold">
                                                    {day.averageBasketSize.toFixed(2)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatNumber(day.transactions)} transaksi •{' '}
                                                    {formatNumber(day.items)} item
                                                </p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Data belum tersedia untuk rata-rata keranjang.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Persediaan</CardTitle>
                            <CardDescription>
                                Produk yang berada di bawah ambang pemesanan ulang
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-baseline justify-between gap-3">
                                <span className="text-4xl font-semibold">
                                    {formatNumber(metrics.totals.lowStockCount)}
                                </span>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <Badge variant="secondary">
                                        Default {formatNumber(metrics.lowStockThreshold)}
                                    </Badge>
                                    {metrics.customReorderCount > 0 && (
                                        <Badge variant="outline">
                                            {formatNumber(metrics.customReorderCount)} ambang kustom
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Pantau dan lakukan pemesanan ulang untuk mencegah kehabisan stok saat permintaan tinggi.
                            </p>
                            <p className="text-xs text-muted-foreground">Terakhir diperbarui {lastUpdatedLabel}</p>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </AppLayout>
    );
}
