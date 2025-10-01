import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

type DiscountType = 'percentage' | 'value';
type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'e_wallet' | 'other';

interface TransactionFormData {
    items: { product_id: number; quantity: number }[];
    discount_type: DiscountType | null;
    discount_value: number | null;
    payment_method: PaymentMethod;
    amount_paid: number;
    notes: string;
}

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
    const lastPrintedTransactionIdRef = useRef<number | null>(null);

    const [discountType, setDiscountType] = useState<DiscountType | null>(null);
    const [discountValueInput, setDiscountValueInput] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [amountPaidInput, setAmountPaidInput] = useState('');
    const [notes, setNotes] = useState('');

    const form = useForm<TransactionFormData>({
        items: [],
        discount_type: null,
        discount_value: null,
        payment_method: 'cash',
        amount_paid: 0,
        notes: '',
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

    const discountAmount = useMemo(() => {
        if (!discountType) {
            return 0;
        }

        const parsed = Number.parseFloat(discountValueInput);
        if (Number.isNaN(parsed) || parsed <= 0) {
            return 0;
        }

        if (discountType === 'percentage') {
            const bounded = Math.min(Math.max(parsed, 0), 100);
            return roundCurrency(totals.total * (bounded / 100));
        }

        return roundCurrency(Math.min(parsed, totals.total));
    }, [discountType, discountValueInput, totals.total]);

    const amountDue = useMemo(
        () => roundCurrency(Math.max(totals.total - discountAmount, 0)),
        [totals.total, discountAmount],
    );

    const normalizedAmountPaid = useMemo(() => {
        const parsed = Number.parseFloat(amountPaidInput);
        if (Number.isNaN(parsed) || parsed <= 0) {
            return 0;
        }

        return roundCurrency(parsed);
    }, [amountPaidInput]);

    const changeDue = useMemo(
        () => roundCurrency(Math.max(normalizedAmountPaid - amountDue, 0)),
        [normalizedAmountPaid, amountDue],
    );

    const customerUrl =
        recentTransactionId != null
            ? buildUrl(customerBaseUrl, '__ID__', recentTransactionId)
            : null;

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (recentTransactionId == null || !customerUrl) {
            return;
        }

        if (lastPrintedTransactionIdRef.current === recentTransactionId) {
            return;
        }

        lastPrintedTransactionIdRef.current = recentTransactionId;

        let urlToOpen = customerUrl;

        try {
            const parsedUrl = new URL(customerUrl, window.location.origin);
            parsedUrl.searchParams.set('print', '1');
            urlToOpen = parsedUrl.toString();
        } catch {
            urlToOpen = `${customerUrl}${customerUrl.includes('?') ? '&' : '?'}print=1`;
        }

        const receiptWindow = window.open(urlToOpen, '_blank', 'noopener,noreferrer');

        if (!receiptWindow) {
            console.warn('Receipt window could not be opened. Please allow pop-ups to auto-print receipts.');
            return;
        }

        receiptWindow.focus();
    }, [recentTransactionId, customerUrl]);

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

    const handleDiscountTypeChange = (value: string) => {
        if (value === 'none') {
            setDiscountType(null);
            setDiscountValueInput('');
            form.setData('discount_type', null);
            form.setData('discount_value', null);
            return;
        }

        const nextType = value as DiscountType;
        setDiscountType(nextType);
        form.setData('discount_type', nextType);

        if (discountValueInput.trim() !== '') {
            const parsed = Number.parseFloat(discountValueInput);
            if (Number.isNaN(parsed) || parsed < 0) {
                form.setData('discount_value', null);
            } else {
                form.setData('discount_value', parsed);
            }
        }
    };

    const handleDiscountValueChange = (value: string) => {
        setDiscountValueInput(value);

        if (!discountType) {
            form.setData('discount_value', null);
            return;
        }

        const parsed = Number.parseFloat(value);
        if (Number.isNaN(parsed) || parsed < 0) {
            form.setData('discount_value', null);
            return;
        }

        form.setData('discount_value', parsed);
    };

    const handlePaymentMethodChange = (value: string) => {
        const method = value as PaymentMethod;
        setPaymentMethod(method);
        form.setData('payment_method', method);
    };

    const handleAmountPaidChange = (value: string) => {
        setAmountPaidInput(value);

        const parsed = Number.parseFloat(value);
        if (Number.isNaN(parsed) || parsed < 0) {
            form.setData('amount_paid', 0);
            return;
        }

        form.setData('amount_paid', roundCurrency(parsed));
    };

    const handleNotesChange = (value: string) => {
        setNotes(value);
        form.setData('notes', value);
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
                setDiscountType(null);
                setDiscountValueInput('');
                setPaymentMethod('cash');
                setAmountPaidInput('');
                setNotes('');
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
                                <div className="flex items-center justify-between">
                                    <span>Discount</span>
                                    <span className="font-medium text-destructive">
                                        {discountAmount > 0
                                            ? `- ${formatCurrency(discountAmount)}`
                                            : formatCurrency(0)}
                                    </span>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex items-center justify-between text-base font-semibold">
                                    <span>Amount due</span>
                                    <span>{formatCurrency(amountDue)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Amount paid</span>
                                    <span className="font-medium">{formatCurrency(normalizedAmountPaid)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Change due</span>
                                    <span className="font-medium">{formatCurrency(changeDue)}</span>
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

                                <div className="grid gap-3">
                                    <div className="grid gap-2">
                                        <Label htmlFor="discount-type">Discount type</Label>
                                        <Select
                                            value={discountType ?? 'none'}
                                            onValueChange={handleDiscountTypeChange}
                                        >
                                            <SelectTrigger id="discount-type">
                                                <SelectValue placeholder="No discount" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No discount</SelectItem>
                                                <SelectItem value="percentage">Percentage</SelectItem>
                                                <SelectItem value="value">Fixed amount</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={form.errors.discount_type} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="discount-value">
                                            {discountType === 'percentage' ? 'Discount (%)' : 'Discount amount'}
                                        </Label>
                                        <Input
                                            id="discount-value"
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            min={0}
                                            max={discountType === 'percentage' ? 100 : undefined}
                                            value={discountValueInput}
                                            onChange={(event) =>
                                                handleDiscountValueChange(event.target.value)
                                            }
                                            disabled={!discountType}
                                        />
                                        <InputError message={form.errors.discount_value} />
                                    </div>
                                </div>

                                <div className="grid gap-3">
                                    <div className="grid gap-2">
                                        <Label htmlFor="payment-method">Payment method</Label>
                                        <Select
                                            value={paymentMethod}
                                            onValueChange={handlePaymentMethodChange}
                                        >
                                            <SelectTrigger id="payment-method">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cash">Cash</SelectItem>
                                                <SelectItem value="card">Card</SelectItem>
                                                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                                                <SelectItem value="e_wallet">E-wallet</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <InputError message={form.errors.payment_method} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="amount-paid">Amount paid</Label>
                                        <Input
                                            id="amount-paid"
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            min={0}
                                            value={amountPaidInput}
                                            onChange={(event) =>
                                                handleAmountPaidChange(event.target.value)
                                            }
                                        />
                                        <InputError message={form.errors.amount_paid} />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="notes">Notes (optional)</Label>
                                    <textarea
                                        id="notes"
                                        value={notes}
                                        onChange={(event) => handleNotesChange(event.target.value)}
                                        className="min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Add any remarks for this sale"
                                    />
                                    <InputError message={form.errors.notes} />
                                </div>

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
