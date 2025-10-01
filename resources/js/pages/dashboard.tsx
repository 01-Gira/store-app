import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    BarChart3,
    CalendarClock,
    Coins,
    PackageOpen,
    ReceiptPercent,
    ShoppingBag,
    TrendingUp,
} from 'lucide-react';

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
    const revenueMax = dailySales.reduce((max, day) => Math.max(max, day.revenue), 0);
    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: metrics.currency ?? 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    const formatNumber = (value: number) => new Intl.NumberFormat('id-ID').format(value);
    const formatPercent = (value: number) =>
        new Intl.NumberFormat('id-ID', {
            style: 'percent',
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value);

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
    const averageDailyRevenue = dailySales.length > 0 ? totalDailyRevenue / dailySales.length : 0;
    const averageDailyProfit = dailySales.length > 0 ? totalDailyProfit / dailySales.length : 0;

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
                                <ReceiptPercent className="h-5 w-5" />
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

                <section className="grid gap-4 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Tren Penjualan Harian</CardTitle>
                            <CardDescription>Performa pendapatan untuk periode {periodLabel}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {dailySales.length > 0 ? (
                                <div className="space-y-6">
                                    <div className="flex h-56 items-end gap-3">
                                        {dailySales.map((day) => {
                                            const height = revenueMax > 0 ? (day.revenue / revenueMax) * 100 : 0;
                                            return (
                                                <div
                                                    key={day.date}
                                                    className="flex w-full flex-col items-center justify-end gap-2 text-center"
                                                >
                                                    <div className="flex h-full w-full items-end rounded-md bg-muted">
                                                        <div
                                                            className="w-full rounded-md rounded-b-none bg-primary/80"
                                                            style={{ height: `${height}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-xs font-medium text-muted-foreground">
                                                        {formatDate(day.date, { month: 'short', day: 'numeric' })}
                                                    </div>
                                                    <div className="text-xs text-foreground">
                                                        {formatCurrency(day.revenue)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-4">
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Pendapatan rata-rata</p>
                                            <p className="text-lg font-semibold">
                                                {formatCurrency(dailySales.length > 0 ? averageDailyRevenue : 0)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Transaksi harian</p>
                                            <p className="text-lg font-semibold">
                                                {(
                                                    dailySales.reduce((sum, day) => sum + day.transactions, 0) /
                                                    dailySales.length
                                                ).toFixed(1)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Item terjual harian</p>
                                            <p className="text-lg font-semibold">
                                                {(
                                                    dailySales.reduce((sum, day) => sum + day.items, 0) /
                                                    dailySales.length
                                                ).toFixed(1)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-muted-foreground">Laba kotor harian</p>
                                            <p className="text-lg font-semibold">
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
