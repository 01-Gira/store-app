import { TablePagination, TableToolbar } from '@/components/table-controls';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useTableControls } from '@/hooks/use-table-controls';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import CustomerLayout from '@/layouts/customer-layout';
import { type SharedData } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCcw } from 'lucide-react';

interface TransactionItemSummary {
    id: number;
    barcode: string;
    name: string;
    quantity: number;
    unit_price: number;
    tax_amount: number;
    line_total: number;
}

type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'e_wallet' | 'other';

interface TransactionSummary {
    id: number;
    number: string;
    created_at: string | null;
    ppn_rate: number;
    subtotal: number;
    tax_total: number;
    discount_total: number;
    total: number;
    items_count: number;
    payment_method: PaymentMethod;
    amount_paid: number;
    change_due: number;
    notes: string | null;
    user: { id: number; name: string } | null;
    customer:
        | {
              id: number;
              name: string;
              email: string | null;
              phone: string | null;
              loyalty_number: string | null;
              loyalty_points: number;
              loyalty_history: LoyaltyHistoryEntry[];
          }
        | null;
    items: TransactionItemSummary[];
}

interface LoyaltyHistoryEntry {
    id: number;
    type: 'earn' | 'redeem';
    points_change: number;
    points_balance: number;
    amount: number;
    created_at: string | null;
}

interface BrandingInfo {
    store_name: string | null;
    contact_details: string | null;
    receipt_footer_text: string | null;
    logo_url: string | null;
    currency_code: string;
    currency_symbol: string;
    language_code: string;
    timezone: string;
}

interface CustomerDisplayProps {
    transaction: TransactionSummary | null;
    autoRefresh: boolean;
    latestUrl: string;
    branding: BrandingInfo;
}

export default function CustomerDisplay({
    transaction,
    autoRefresh,
    latestUrl,
    branding,
}: CustomerDisplayProps) {
    const { storeSettings } = usePage<SharedData>().props;
    const locale = branding.language_code ?? storeSettings?.language_code ?? 'id-ID';
    const currencyCode = branding.currency_code ?? storeSettings?.currency_code ?? 'IDR';
    const timezone = branding.timezone ?? storeSettings?.timezone ?? 'Asia/Jakarta';
    const currencyFormatter = useMemo(
        () =>
            new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: 2,
            }),
        [currencyCode, locale],
    );
    const dateFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: timezone,
            }),
        [locale, timezone],
    );
    const numberLocale = locale;
    const paymentMethodLabels: Record<PaymentMethod, string> = {
        cash: 'Tunai',
        card: 'Kartu',
        bank_transfer: 'Transfer bank',
        e_wallet: 'Dompet digital',
        other: 'Lainnya',
    };
    const loyaltyTypeLabels: Record<LoyaltyHistoryEntry['type'], string> = {
        earn: 'Poin diterima',
        redeem: 'Poin digunakan',
    };

    const formatCurrency = (value: number) => currencyFormatter.format(value);
    const formatDate = (value: string | null) => {
        if (!value) {
            return '';
        }

        return dateFormatter.format(new Date(value));
    };
    const [shouldAutoPrint, setShouldAutoPrint] = useState(false);
    const hasPrintedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('print') === '1') {
            setShouldAutoPrint(true);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!shouldAutoPrint || !transaction || hasPrintedRef.current) {
            return;
        }

        hasPrintedRef.current = true;
        window.print();

        if (window.history && window.history.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('print');
            window.history.replaceState({}, document.title, url.toString());
        }
    }, [shouldAutoPrint, transaction]);

    useEffect(() => {
        if (!autoRefresh) {
            return;
        }

        const interval = window.setInterval(() => {
            router.reload({ only: ['transaction'], preserveScroll: true, preserveState: true });
        }, 5000);

        return () => window.clearInterval(interval);
    }, [autoRefresh]);

    const handleManualRefresh = () => {
        router.visit(latestUrl, {
            only: ['transaction'],
            preserveScroll: true,
            preserveState: true,
        });
    };

    const transactionItems = transaction?.items ?? [];
    const transactionItemControls = useTableControls(transactionItems, {
        searchFields: [
            (item) => item.name,
            (item) => item.barcode,
        ],
        filters: [
            { label: 'Semua produk', value: 'all' },
            {
                label: 'Dengan pajak',
                value: 'with-tax',
                predicate: (item) => item.tax_amount > 0,
            },
            {
                label: 'Kuantitas > 1',
                value: 'multi-qty',
                predicate: (item) => item.quantity > 1,
            },
        ],
        initialPageSize: 5,
    });
    const paymentMethodLabel = transaction
        ? paymentMethodLabels[transaction.payment_method] ?? transaction.payment_method
        : '';

    return (
        <CustomerLayout>
            <Head title="Customer display" />

            <div className="space-y-6">
                <header className="space-y-3 text-center">
                    {branding.logo_url && (
                        <div className="flex justify-center">
                            <img
                                src={branding.logo_url}
                                alt={`${branding.store_name ?? 'Store'} logo`}
                                className="h-24 w-auto rounded-md border border-border bg-white p-3 shadow-sm"
                            />
                        </div>
                    )}
                    <h1 className="text-4xl font-bold tracking-tight">
                        {branding.store_name ?? 'Terima kasih telah berbelanja'}
                    </h1>
                    <div className="space-y-1 text-lg text-muted-foreground">
                        {branding.store_name && (
                            <p>Terima kasih telah berbelanja bersama kami.</p>
                        )}
                        {branding.contact_details && (
                            <p className="whitespace-pre-line text-base text-muted-foreground">
                                {branding.contact_details}
                            </p>
                        )}
                        <p className="text-base text-muted-foreground">
                            Harap pastikan semua item sudah sesuai sebelum melakukan pembayaran.
                        </p>
                    </div>
                </header>

                {autoRefresh && (
                    <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
                        <AlertTitle>Tampilan pelanggan</AlertTitle>
                        <AlertDescription>
                            Layar ini diperbarui otomatis setiap 5 detik untuk menampilkan transaksi terbaru.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="space-y-1 text-sm text-muted-foreground">
                        {transaction ? (
                            <>
                                <div>
                                    Nomor transaksi:{' '}
                                    <span className="font-semibold text-foreground">{transaction.number}</span>
                                </div>
                                <div>Waktu: {formatDate(transaction.created_at)}</div>
                                {transaction.user && <div>Kasir: {transaction.user.name}</div>}
                                {transaction.customer && (
                                    <div>
                                        Pelanggan: {transaction.customer.name}
                                        {transaction.customer.loyalty_number && (
                                            <>
                                                {' '}
                                                · ID Loyalti {transaction.customer.loyalty_number}
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div>Belum ada transaksi yang diselesaikan.</div>
                        )}
                    </div>

                    <Button type="button" variant="outline" onClick={handleManualRefresh}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Muat ulang
                    </Button>
                </div>

                {transaction ? (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <TableToolbar
                                searchTerm={transactionItemControls.searchTerm}
                                onSearchChange={transactionItemControls.setSearchTerm}
                                searchPlaceholder="Cari produk atau barcode"
                                filterOptions={transactionItemControls.filterOptions}
                                filterValue={transactionItemControls.filterValue}
                                onFilterChange={transactionItemControls.setFilterValue}
                                pageSize={transactionItemControls.pageSize}
                                pageSizeOptions={transactionItemControls.pageSizeOptions}
                                onPageSizeChange={transactionItemControls.setPageSize}
                                total={transactionItemControls.total}
                                filteredTotal={transactionItemControls.filteredTotal}
                            />

                            <div className="overflow-hidden rounded-xl border border-border bg-background">
                                <table className="min-w-full divide-y divide-border text-lg">
                                    <thead className="bg-muted/50 text-base uppercase tracking-wide">
                                        <tr>
                                            <th className="px-6 py-4 text-left">Produk</th>
                                            <th className="px-6 py-4 text-center">Jumlah</th>
                                            <th className="px-6 py-4 text-right">Harga</th>
                                            <th className="px-6 py-4 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {transactionItemControls.total === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-6 py-6 text-center text-base text-muted-foreground"
                                                >
                                                    Belum ada item dalam transaksi ini.
                                                </td>
                                            </tr>
                                        ) : transactionItemControls.filteredTotal === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-6 py-6 text-center text-base text-muted-foreground"
                                                >
                                                    Tidak ada item yang cocok dengan pencarian atau filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            transactionItemControls.items.map((item) => (
                                                <tr key={item.id}>
                                                    <td className="px-6 py-4">
                                                        <div className="text-xl font-semibold">{item.name}</div>
                                                        <div className="text-sm text-muted-foreground">{item.barcode}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-medium">{item.quantity}</td>
                                                    <td className="px-6 py-4 text-right">{formatCurrency(item.unit_price)}</td>
                                                    <td className="px-6 py-4 text-right font-semibold">
                                                        {formatCurrency(item.line_total)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <TablePagination
                                page={transactionItemControls.page}
                                pageCount={transactionItemControls.pageCount}
                                onPageChange={transactionItemControls.goToPage}
                                range={transactionItemControls.range}
                                total={transactionItemControls.total}
                                filteredTotal={transactionItemControls.filteredTotal}
                            />
                        </div>

                        <div className="space-y-4 rounded-xl border border-border bg-background p-6">
                            <div className="flex items-center justify-between text-3xl font-bold">
                                <span>Total Pembayaran</span>
                                <span>{formatCurrency(transaction.total)}</span>
                            </div>
                            <Separator />
                            <div className="space-y-2 text-base">
                                <div className="flex items-center justify-between text-sm">
                                    <span>Jumlah item</span>
                                    <span className="font-medium text-foreground">
                                        {transaction.items_count.toLocaleString(numberLocale)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Subtotal</span>
                                    <span className="font-medium">
                                        {formatCurrency(transaction.subtotal)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>PPN ({transaction.ppn_rate}%)</span>
                                    <span className="font-medium">
                                        {formatCurrency(transaction.tax_total)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Diskon</span>
                                    <span
                                        className={cn(
                                            'font-medium',
                                            transaction.discount_total > 0
                                                ? 'text-destructive'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {transaction.discount_total > 0
                                            ? `- ${formatCurrency(transaction.discount_total)}`
                                            : formatCurrency(0)}
                                    </span>
                                </div>
                            </div>
                            <Separator />
                            <div className="space-y-2 text-base">
                                <div className="flex items-center justify-between">
                                    <span>Metode pembayaran</span>
                                    <span className="font-medium">{paymentMethodLabel}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Total dibayarkan</span>
                                    <span className="font-semibold">
                                        {formatCurrency(transaction.amount_paid)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Kembalian</span>
                                    <span
                                        className={cn(
                                            'font-semibold',
                                            transaction.change_due > 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {formatCurrency(transaction.change_due)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {transaction.notes && transaction.notes.trim() !== '' && (
                            <div className="rounded-xl border border-border bg-background p-6 text-lg">
                                <h3 className="text-2xl font-semibold">Catatan kasir</h3>
                                <p className="mt-3 whitespace-pre-line text-base text-muted-foreground">
                                    {transaction.notes}
                                </p>
                            </div>
                        )}

                        {transaction.customer && (
                            <div className="rounded-xl border border-border bg-background p-6 text-lg">
                                <h3 className="text-2xl font-semibold">Informasi pelanggan</h3>
                                <dl className="mt-4 space-y-2 text-base">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <dt className="text-muted-foreground">Nama</dt>
                                        <dd className="font-medium text-foreground">
                                            {transaction.customer.name}
                                        </dd>
                                    </div>
                                    {transaction.customer.email && (
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <dt className="text-muted-foreground">Email</dt>
                                            <dd className="font-medium text-foreground">
                                                {transaction.customer.email}
                                            </dd>
                                        </div>
                                    )}
                                    {transaction.customer.phone && (
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <dt className="text-muted-foreground">Telepon</dt>
                                            <dd className="font-medium text-foreground">
                                                {transaction.customer.phone}
                                            </dd>
                                        </div>
                                    )}
                                    {transaction.customer.loyalty_number && (
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <dt className="text-muted-foreground">ID Loyalti</dt>
                                            <dd className="font-medium text-foreground">
                                                {transaction.customer.loyalty_number}
                                            </dd>
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <dt className="text-muted-foreground">Poin</dt>
                                        <dd className="font-medium text-foreground">
                                            {transaction.customer.loyalty_points.toLocaleString(numberLocale)}
                                        </dd>
                                    </div>
                                </dl>
                                <div className="mt-6 space-y-3">
                                    <h4 className="text-xl font-semibold">Riwayat loyalti terbaru</h4>
                                    {transaction.customer.loyalty_history.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Belum ada aktivitas loyalti untuk pelanggan ini.
                                        </p>
                                    ) : (
                                        <div className="overflow-hidden rounded-lg border border-border">
                                            <table className="min-w-full divide-y divide-border text-sm">
                                                <thead className="bg-muted/50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                                                        <th className="px-4 py-3 text-left font-medium">Aktivitas</th>
                                                        <th className="px-4 py-3 text-right font-medium">Perubahan poin</th>
                                                        <th className="px-4 py-3 text-right font-medium">Saldo</th>
                                                        <th className="px-4 py-3 text-right font-medium">Nominal</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {transaction.customer.loyalty_history.map((entry) => {
                                                        const formattedChange = `${entry.points_change > 0 ? '+' : ''}${entry.points_change.toLocaleString(numberLocale)}`;

                                                        return (
                                                            <tr key={entry.id}>
                                                                <td className="px-4 py-3">
                                                                    {entry.created_at ? formatDate(entry.created_at) : '-'}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    {loyaltyTypeLabels[entry.type]}
                                                                </td>
                                                                <td
                                                                    className={cn(
                                                                        'px-4 py-3 text-right font-medium',
                                                                        entry.points_change < 0
                                                                            ? 'text-destructive'
                                                                            : 'text-emerald-600 dark:text-emerald-400',
                                                                    )}
                                                                >
                                                                    {formattedChange}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    {entry.points_balance.toLocaleString(numberLocale)}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    {formatCurrency(entry.amount)}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-border bg-background/60 p-12 text-center">
                        <h2 className="text-2xl font-semibold">Menunggu transaksi berikutnya</h2>
                        <p className="mt-2 text-base text-muted-foreground">
                            Setelah kasir menyelesaikan transaksi, detail belanja Anda akan muncul di layar ini.
                        </p>
                    </div>
                )}

                <footer className="rounded-xl border border-dashed border-border bg-background/70 p-6 text-center text-base text-muted-foreground">
                    {branding.receipt_footer_text ? (
                        <p className="whitespace-pre-line text-sm text-muted-foreground">
                            {branding.receipt_footer_text}
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Simpan struk ini sebagai bukti pembayaran dan hubungi kasir bila ada pertanyaan.
                        </p>
                    )}
                </footer>
            </div>
        </CustomerLayout>
    );
}
