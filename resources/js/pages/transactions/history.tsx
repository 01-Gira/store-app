import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEvent, useMemo } from 'react';

interface CashierOption {
    id: number;
    name: string;
}

interface CustomerOption {
    id: number;
    name: string;
}

interface TransactionRow {
    id: number;
    number: string;
    created_at: string | null;
    subtotal: number;
    tax_total: number;
    total: number;
    items_count: number;
    cashier: { id: number; name: string } | null;
    customer: {
        id: number;
        name: string;
        email: string | null;
        phone: string | null;
        loyalty_number: string | null;
        loyalty_points: number;
    } | null;
    detail_url: string;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedResponse<T> {
    data: T[];
    links: PaginationLink[];
    from: number | null;
    to: number | null;
    total: number;
}

interface HistoryFilters {
    start_date: string | null;
    end_date: string | null;
    cashier_id: number | null;
    customer_id: number | null;
    min_total: number | null;
    max_total: number | null;
}

interface HistorySummary {
    transactions: number;
    subtotal: number;
    tax_total: number;
    total: number;
    items: number;
}

interface DailyBreakdownPoint {
    date: string;
    revenue: number;
    transactions: number;
    items: number;
}

interface TransactionHistoryPageProps {
    filters: HistoryFilters;
    transactions: PaginatedResponse<TransactionRow>;
    summary: HistorySummary;
    daily: DailyBreakdownPoint[];
    cashiers: CashierOption[];
    customers: CustomerOption[];
    historyUrl: string;
    employeeUrl: string;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
    }).format(value);

const formatDateTime = (value: string | null) => {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
};

export default function TransactionHistory({
    filters,
    transactions,
    summary,
    daily,
    cashiers,
    customers,
    historyUrl,
    employeeUrl,
}: TransactionHistoryPageProps) {
    const form = useForm({
        start_date: filters.start_date ?? '',
        end_date: filters.end_date ?? '',
        cashier_id: filters.cashier_id ? String(filters.cashier_id) : '',
        customer_id: filters.customer_id ? String(filters.customer_id) : '',
        min_total: filters.min_total != null ? String(filters.min_total) : '',
        max_total: filters.max_total != null ? String(filters.max_total) : '',
    });

    const appliedFilters = useMemo(
        () =>
            [
                form.data.start_date && {
                    label: 'Mulai',
                    value: form.data.start_date,
                },
                form.data.end_date && {
                    label: 'Selesai',
                    value: form.data.end_date,
                },
                form.data.cashier_id && {
                    label: 'Kasir',
                    value:
                        cashiers.find((cashier) =>
                            cashier.id === Number(form.data.cashier_id),
                        )?.name ?? 'Tidak diketahui',
                },
                form.data.customer_id && {
                    label: 'Pelanggan',
                    value:
                        customers.find((customer) =>
                            customer.id === Number(form.data.customer_id),
                        )?.name ?? 'Tidak diketahui',
                },
                form.data.min_total && {
                    label: 'Total minimum',
                    value: formatCurrency(Number(form.data.min_total)),
                },
                form.data.max_total && {
                    label: 'Total maksimum',
                    value: formatCurrency(Number(form.data.max_total)),
                },
            ].filter(Boolean) as { label: string; value: string }[],
        [
            cashiers,
            customers,
            form.data.cashier_id,
            form.data.customer_id,
            form.data.end_date,
            form.data.max_total,
            form.data.min_total,
            form.data.start_date,
        ],
    );

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        form.get(historyUrl, {
            replace: true,
            preserveScroll: true,
        });
    };

    const handleReset = () => {
        form.setData({
            start_date: '',
            end_date: '',
            cashier_id: '',
            customer_id: '',
            min_total: '',
            max_total: '',
        });

        form.get(historyUrl, {
            replace: true,
            preserveScroll: true,
        });
    };

    return (
        <AppLayout
            breadcrumbs={[
                { title: 'Transaksi', href: employeeUrl },
                { title: 'Riwayat', href: historyUrl },
            ]}
        >
            <Head title="Riwayat Transaksi" />

            <div className="space-y-6">
                <header className="space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Riwayat transaksi
                    </h1>
                    <p className="text-muted-foreground">
                        Tinjau transaksi sebelumnya, filter berdasarkan kasir atau
                        rentang tanggal, dan analisa performa penjualan toko.
                    </p>
                </header>

                <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Filter</CardTitle>
                            <CardDescription>
                                Pilih kriteria untuk mempersempit daftar transaksi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
                                <div className="space-y-2">
                                    <Label htmlFor="start_date">Tanggal mulai</Label>
                                    <Input
                                        id="start_date"
                                        type="date"
                                        value={form.data.start_date}
                                        onChange={(event) =>
                                            form.setData('start_date', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="end_date">Tanggal selesai</Label>
                                    <Input
                                        id="end_date"
                                        type="date"
                                        value={form.data.end_date}
                                        onChange={(event) =>
                                            form.setData('end_date', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kasir</Label>
                                    <Select
                                        value={form.data.cashier_id || 'all'}
                                        onValueChange={(value) =>
                                             form.setData(
                                                'cashier_id',
                                                value === 'all' ? '' : value,
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Semua kasir" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua kasir</SelectItem>
                                            {cashiers.map((cashier) => (
                                                <SelectItem
                                                    key={cashier.id}
                                                    value={String(cashier.id)}
                                                >
                                                    {cashier.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Pelanggan</Label>
                                    <Select
                                        value={form.data.customer_id || 'all'}
                                        onValueChange={(value) =>
                                            form.setData(
                                                'customer_id',
                                                value === 'all' ? '' : value,
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Semua pelanggan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Semua pelanggan</SelectItem>
                                            {customers.map((customer) => (
                                                <SelectItem
                                                    key={customer.id}
                                                    value={String(customer.id)}
                                                >
                                                    {customer.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="min_total">Total minimum</Label>
                                    <Input
                                        id="min_total"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0"
                                        value={form.data.min_total}
                                        onChange={(event) =>
                                            form.setData('min_total', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="max_total">Total maksimum</Label>
                                    <Input
                                        id="max_total"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0"
                                        value={form.data.max_total}
                                        onChange={(event) =>
                                            form.setData('max_total', event.target.value)
                                        }
                                    />
                                </div>
                                <div className="flex items-end gap-2">
                                    <Button type="submit" disabled={form.processing}>
                                        Terapkan
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleReset}
                                        disabled={form.processing}
                                    >
                                        Setel ulang
                                    </Button>
                                </div>
                            </form>

                            {appliedFilters.length > 0 && (
                                <div className="mt-6 space-y-2">
                                    <h3 className="text-sm font-medium text-muted-foreground">
                                        Filter aktif
                                    </h3>
                                    <ul className="flex flex-wrap gap-2 text-sm">
                                        {appliedFilters.map((filter) => (
                                            <li
                                                key={`${filter.label}-${filter.value}`}
                                                className="rounded-full border border-border px-3 py-1"
                                            >
                                                <span className="font-medium text-foreground">
                                                    {filter.label}:
                                                </span>{' '}
                                                {filter.value}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle>Ringkasan</CardTitle>
                            <CardDescription>
                                Angka agregat berdasarkan filter yang diterapkan.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <dl className="grid gap-4">
                                <div className="rounded-lg border border-border p-4">
                                    <dt className="text-sm text-muted-foreground">
                                        Total transaksi
                                    </dt>
                                    <dd className="text-2xl font-semibold text-foreground">
                                        {summary.transactions.toLocaleString('id-ID')}
                                    </dd>
                                </div>
                                <div className="rounded-lg border border-border p-4">
                                    <dt className="text-sm text-muted-foreground">
                                        Barang terjual
                                    </dt>
                                    <dd className="text-2xl font-semibold text-foreground">
                                        {summary.items.toLocaleString('id-ID')}
                                    </dd>
                                </div>
                                <div className="rounded-lg border border-border p-4">
                                    <dt className="text-sm text-muted-foreground">
                                        Subtotal
                                    </dt>
                                    <dd className="text-xl font-semibold text-foreground">
                                        {formatCurrency(summary.subtotal)}
                                    </dd>
                                </div>
                                <div className="rounded-lg border border-border p-4">
                                    <dt className="text-sm text-muted-foreground">
                                        Pajak
                                    </dt>
                                    <dd className="text-xl font-semibold text-foreground">
                                        {formatCurrency(summary.tax_total)}
                                    </dd>
                                </div>
                                <div className="rounded-lg border border-border p-4">
                                    <dt className="text-sm text-muted-foreground">
                                        Total penjualan
                                    </dt>
                                    <dd className="text-xl font-semibold text-foreground">
                                        {formatCurrency(summary.total)}
                                    </dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Daftar transaksi</CardTitle>
                        <CardDescription>
                            Menampilkan transaksi terbaru terlebih dahulu sesuai filter.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-border text-left text-sm">
                                <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Nomor</th>
                                        <th className="px-4 py-3 font-medium">Waktu</th>
                                        <th className="px-4 py-3 font-medium text-right">Barang</th>
                                        <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                                        <th className="px-4 py-3 font-medium text-right">Pajak</th>
                                        <th className="px-4 py-3 font-medium text-right">Total</th>
                                        <th className="px-4 py-3 font-medium">Kasir</th>
                                        <th className="px-4 py-3 font-medium">Pelanggan</th>
                                        <th className="px-4 py-3 font-medium text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {transactions.data.length > 0 ? (
                                        transactions.data.map((transaction) => (
                                            <tr key={transaction.id} className="hover:bg-muted/30">
                                                <td className="px-4 py-3 font-medium">
                                                    {transaction.number}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {formatDateTime(transaction.created_at)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {transaction.items_count.toLocaleString('id-ID')}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {formatCurrency(transaction.subtotal)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {formatCurrency(transaction.tax_total)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {formatCurrency(transaction.total)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {transaction.cashier?.name ?? '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {transaction.customer ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-medium text-foreground">
                                                                {transaction.customer.name}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {[
                                                                    transaction.customer.email,
                                                                    transaction.customer.phone,
                                                                    transaction.customer.loyalty_number,
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(' • ')}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={transaction.detail_url}>
                                                            Detail
                                                        </Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="px-4 py-6 text-center text-muted-foreground"
                                            >
                                                Tidak ada transaksi yang cocok dengan filter saat ini.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
                            <div>
                                Menampilkan {transactions.from ?? 0} - {transactions.to ?? 0} dari{' '}
                                {transactions.total.toLocaleString('id-ID')} transaksi
                            </div>
                            <nav className="flex flex-wrap items-center gap-2">
                                {transactions.links.map((link, index) => {
                                    const classes = `rounded-md border px-3 py-1 text-sm transition-colors ${
                                        link.active
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-background text-foreground hover:bg-muted'
                                    }`;

                                    if (link.url === null) {
                                        return (
                                            <span
                                                key={`${link.label}-${index}`}
                                                className={`${classes} pointer-events-none opacity-50`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        );
                                    }

                                    return (
                                        <Link
                                            key={`${link.label}-${index}`}
                                            href={link.url}
                                            className={classes}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    );
                                })}
                            </nav>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Ringkasan harian</CardTitle>
                        <CardDescription>
                            Total penjualan per hari sebagai referensi cepat tanpa grafik.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {daily.length > 0 ? (
                            <ul className="divide-y divide-border text-sm">
                                {daily.map((entry) => (
                                    <li
                                        key={entry.date}
                                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                                    >
                                        <div>
                                            <p className="font-medium text-foreground">
                                                {new Intl.DateTimeFormat('id-ID', {
                                                    dateStyle: 'medium',
                                                }).format(new Date(entry.date))}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {entry.transactions.toLocaleString('id-ID')} transaksi ·{' '}
                                                {entry.items.toLocaleString('id-ID')} item
                                            </p>
                                        </div>
                                        <div className="text-base font-semibold text-foreground">
                                            {formatCurrency(entry.revenue)}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Tidak ada data harian untuk rentang tanggal yang dipilih.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
