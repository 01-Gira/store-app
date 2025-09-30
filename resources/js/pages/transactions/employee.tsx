import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RefreshCcw, ScanLine, Trash2 } from 'lucide-react';

interface TransactionProduct {
    id: number;
    barcode: string;
    name: string;
    price: number;
}

interface EmployeeTransactionsPageProps {
    ppnRate: number;
    productLookupUrl: string;
    storeUrl: string;
    recentTransactionId?: number | null;
    customerBaseUrl: string;
    customerLatestUrl: string;
}

interface CartItem extends TransactionProduct {
    quantity: number;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 2,
    }).format(value);

const buildUrl = (template: string, placeholder: string, value: string | number) =>
    template.replace(placeholder, encodeURIComponent(String(value)));

export default function EmployeeTransactions({
    ppnRate,
    productLookupUrl,
    storeUrl,
    recentTransactionId,
    customerBaseUrl,
    customerLatestUrl,
}: EmployeeTransactionsPageProps) {
    const { flash } = usePage<SharedData>().props;
    const [items, setItems] = useState<CartItem[]>([]);
    const [manualBarcode, setManualBarcode] = useState('');
    const [scannerEnabled, setScannerEnabled] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const readerRef = useRef<BrowserMultiFormatReader | null>(null);
    const processedBarcodesRef = useRef<Set<string>>(new Set());

    const form = useForm<{ items: { product_id: number; quantity: number }[] }>({
        items: [],
    });

    const totals = useMemo(() => {
        const subtotal = items.reduce(
            (total, item) => total + item.price * item.quantity,
            0,
        );
        const tax = subtotal * (ppnRate / 100);
        const total = subtotal + tax;

        return {
            subtotal,
            tax,
            total,
        };
    }, [items, ppnRate]);

    const customerUrl =
        recentTransactionId != null
            ? buildUrl(customerBaseUrl, '__ID__', recentTransactionId)
            : null;

    useEffect(() => {
        if (!scannerEnabled) {
            cleanupScanner();
            return;
        }

        if (!videoRef.current) {
            return;
        }

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;
        setScanError(null);

        reader
            .decodeFromVideoDevice(
                undefined,
                videoRef.current,
                (result, error) => {
                    if (result) {
                        const text = result.getText();
                        if (text && !processedBarcodesRef.current.has(text)) {
                            processedBarcodesRef.current.add(text);
                            handleProductLookup(text);
                            setTimeout(
                                () => processedBarcodesRef.current.delete(text),
                                1000,
                            );
                        }
                    }

                    if (error && !('name' in error && error.name === 'NotFoundException')) {
                        setScanError('Unable to read barcode. Try adjusting the camera.');
                    }
                },
            )
            .catch(() => {
                setScanError('Camera access was denied or not available.');
                cleanupScanner();
                setScannerEnabled(false);
            });

        return () => {
            cleanupScanner();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scannerEnabled]);

    const cleanupScanner = () => {
        readerRef.current?.reset();
        readerRef.current = null;

        const stream = videoRef.current?.srcObject;
        if (stream instanceof MediaStream) {
            stream.getTracks().forEach((track) => track.stop());
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const handleProductLookup = async (barcode: string) => {
        const trimmed = barcode.trim();
        if (!trimmed) {
            return;
        }

        setLookupError(null);
        setIsLookingUp(true);

        try {
            const response = await fetch(
                buildUrl(productLookupUrl, '__BARCODE__', trimmed),
                {
                    headers: {
                        Accept: 'application/json',
                    },
                },
            );

            if (!response.ok) {
                setLookupError('Product not found for the provided barcode.');
                return;
            }

            const data = (await response.json()) as TransactionProduct;
            addProductToCart(data);
        } catch (error) {
            console.error(error);
            setLookupError('Unable to fetch product details. Please try again.');
        } finally {
            setIsLookingUp(false);
        }
    };

    const addProductToCart = (product: TransactionProduct) => {
        setItems((current) => {
            const existing = current.find((item) => item.id === product.id);

            if (existing) {
                return current.map((item) =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item,
                );
            }

            return [
                ...current,
                {
                    ...product,
                    quantity: 1,
                },
            ];
        });

        setManualBarcode('');
        setLookupError(null);
    };

    const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!manualBarcode.trim()) {
            setLookupError('Enter a barcode to look up a product.');
            return;
        }

        handleProductLookup(manualBarcode);
    };

    const handleQuantityChange = (productId: number, quantity: number) => {
        if (Number.isNaN(quantity) || quantity < 1) {
            return;
        }

        setItems((current) =>
            current.map((item) =>
                item.id === productId
                    ? { ...item, quantity: Math.floor(quantity) }
                    : item,
            ),
        );
    };

    const handleIncrement = (productId: number) => {
        setItems((current) =>
            current.map((item) =>
                item.id === productId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item,
            ),
        );
    };

    const handleDecrement = (productId: number) => {
        setItems((current) =>
            current.map((item) =>
                item.id === productId && item.quantity > 1
                    ? { ...item, quantity: item.quantity - 1 }
                    : item,
            ),
        );
    };

    const handleRemove = (productId: number) => {
        setItems((current) => current.filter((item) => item.id !== productId));
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (items.length === 0) {
            form.setError('items', 'Add at least one product before saving.');
            return;
        }

        form.setData(
            'items',
            items.map((item) => ({
                product_id: item.id,
                quantity: item.quantity,
            })),
        );

        form.post(storeUrl, {
            preserveScroll: true,
            onSuccess: () => {
                setItems([]);
                form.reset();
            },
        });
    };

    useEffect(() => () => cleanupScanner(), []);

    return (
        <AppLayout>
            <Head title="Point of Sale" />

            <div className="space-y-6 p-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">Employee POS</h1>
                        <p className="text-sm text-muted-foreground">
                            Scan product barcodes or search manually to build a transaction.
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Current PPN rate: <span className="font-medium">{ppnRate}%</span>
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right text-sm">
                        <Button
                            type="button"
                            variant={scannerEnabled ? 'secondary' : 'default'}
                            onClick={() => setScannerEnabled((value) => !value)}
                        >
                            <ScanLine className="mr-2 h-4 w-4" />
                            {scannerEnabled ? 'Stop scanner' : 'Start scanner'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleProductLookup(manualBarcode)}
                            disabled={isLookingUp || !manualBarcode.trim()}
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Refresh lookup
                        </Button>
                    </div>
                </div>

                {flash?.success && (
                    <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100">
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                {customerUrl && (
                    <Alert>
                        <AlertTitle>Customer display ready</AlertTitle>
                        <AlertDescription>
                            <a
                                href={customerUrl}
                                className="font-medium text-primary hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open the latest receipt for your customer
                            </a>
                            . You can also monitor the live display at{' '}
                            <a
                                href={customerLatestUrl}
                                className="font-medium text-primary hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                /transactions/customer/latest
                            </a>
                            .
                        </AlertDescription>
                    </Alert>
                )}

                {scanError && (
                    <Alert className="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-100">
                        <AlertTitle>Scanner notice</AlertTitle>
                        <AlertDescription>{scanError}</AlertDescription>
                    </Alert>
                )}

                {lookupError && (
                    <Alert className="border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
                        <AlertTitle>Lookup error</AlertTitle>
                        <AlertDescription>{lookupError}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                    <div className="space-y-6">
                        <Card className="p-4">
                            <form className="space-y-4" onSubmit={handleManualSubmit}>
                                <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                                    <div className="space-y-2">
                                        <Label htmlFor="barcode">Manual barcode entry</Label>
                                        <Input
                                            id="barcode"
                                            value={manualBarcode}
                                            placeholder="Scan or type a barcode"
                                            onChange={(event) => setManualBarcode(event.target.value)}
                                        />
                                    </div>
                                    <Button type="submit" className="w-full md:w-auto" disabled={isLookingUp}>
                                        Add product
                                    </Button>
                                </div>
                            </form>
                        </Card>

                        {scannerEnabled && (
                            <Card className="overflow-hidden">
                                <div className="bg-muted p-4">
                                    <video
                                        ref={videoRef}
                                        className="h-64 w-full rounded-lg object-cover"
                                        autoPlay
                                        playsInline
                                        muted
                                    />
                                </div>
                            </Card>
                        )}

                        <Card className="overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-border text-sm">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">Product</th>
                                            <th className="px-4 py-3 text-left font-medium">Price</th>
                                            <th className="px-4 py-3 text-left font-medium">Quantity</th>
                                            <th className="px-4 py-3 text-left font-medium">Line total</th>
                                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                                                    Scan a barcode or add a product manually to begin.
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map((item) => {
                                                const lineTotal = item.price * item.quantity;

                                                return (
                                                    <tr key={item.id}>
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium">{item.name}</div>
                                                            <div className="text-xs text-muted-foreground">{item.barcode}</div>
                                                        </td>
                                                        <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="outline"
                                                                    onClick={() => handleDecrement(item.id)}
                                                                    disabled={item.quantity <= 1}
                                                                >
                                                                    <Minus className="h-4 w-4" />
                                                                </Button>
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    className="w-20"
                                                                    value={item.quantity}
                                                                    onChange={(event) =>
                                                                        handleQuantityChange(
                                                                            item.id,
                                                                            Number.parseInt(event.target.value, 10),
                                                                        )
                                                                    }
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="outline"
                                                                    onClick={() => handleIncrement(item.id)}
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3">{formatCurrency(lineTotal)}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Button
                                                                type="button"
                                                                variant="destructive"
                                                                size="icon"
                                                                onClick={() => handleRemove(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="space-y-4 p-4">
                            <h2 className="text-lg font-semibold">Transaction summary</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span>Subtotal</span>
                                    <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>PPN ({ppnRate}%)</span>
                                    <span className="font-medium">{formatCurrency(totals.tax)}</span>
                                </div>
                                <div className="flex items-center justify-between text-base font-semibold">
                                    <span>Total</span>
                                    <span>{formatCurrency(totals.total)}</span>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-4">
                            <form className="space-y-4" onSubmit={handleSubmit}>
                                <div>
                                    <h3 className="text-lg font-semibold">Finalize sale</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Confirm the items to record this transaction and update stock levels.
                                    </p>
                                </div>

                                <InputError message={form.errors.items} />

                                <Button type="submit" className="w-full" disabled={form.processing || items.length === 0}>
                                    Complete transaction
                                </Button>
                            </form>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
