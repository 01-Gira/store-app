import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import CustomerLayout from '@/layouts/customer-layout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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

interface TransactionSummary {
    id: number;
    number: string;
    created_at: string | null;
    ppn_rate: number;
    subtotal: number;
    tax_total: number;
    total: number;
    items_count: number;
    user: { id: number; name: string } | null;
    items: TransactionItemSummary[];
}

interface CustomerDisplayProps {
    transaction: TransactionSummary | null;
    autoRefresh: boolean;
    latestUrl: string;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
    }).format(value);

const formatDate = (value: string | null) => {
    if (!value) {
        return '';
    }

    return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
};

export default function CustomerDisplay({ transaction, autoRefresh, latestUrl }: CustomerDisplayProps) {
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

    return (
        <CustomerLayout>
            <Head title="Customer display" />

            <div className="space-y-6">
                <header className="space-y-1 text-center">
                    <h1 className="text-4xl font-bold tracking-tight">Terima kasih telah berbelanja</h1>
                    <p className="text-lg text-muted-foreground">
                        Harap pastikan semua item sudah sesuai sebelum melakukan pembayaran.
                    </p>
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
                                    <span className="font-semibold text-foreground">
                                        {transaction.number}
                                    </span>
                                </div>
                                <div>Waktu: {formatDate(transaction.created_at)}</div>
                                {transaction.user && <div>Kasir: {transaction.user.name}</div>}
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
                                    {transaction.items.map((item) => (
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
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="space-y-3 rounded-xl border border-border bg-background p-6 text-2xl">
                            <div className="flex items-center justify-between">
                                <span>Subtotal</span>
                                <span>{formatCurrency(transaction.subtotal)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>PPN ({transaction.ppn_rate}%)</span>
                                <span>{formatCurrency(transaction.tax_total)}</span>
                            </div>
                            <div className="flex items-center justify-between text-3xl font-bold">
                                <span>Total Pembayaran</span>
                                <span>{formatCurrency(transaction.total)}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-border bg-background/60 p-12 text-center">
                        <h2 className="text-2xl font-semibold">Menunggu transaksi berikutnya</h2>
                        <p className="mt-2 text-base text-muted-foreground">
                            Setelah kasir menyelesaikan transaksi, detail belanja Anda akan muncul di layar ini.
                        </p>
                    </div>
                )}
            </div>
        </CustomerLayout>
    );
}
