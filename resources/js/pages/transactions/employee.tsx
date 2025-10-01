import { TablePagination, TableToolbar } from '@/components/table-controls';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTableControls } from '@/hooks/use-table-controls';
import AppLayout from '@/layouts/app-layout';
import { type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RefreshCcw, ScanLine, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransactionProduct {
    id: number;
    barcode: string;
    name: string;
    price: number;
}

interface CustomerSummary {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    loyalty_number: string | null;
    loyalty_points: number;
    enrolled_at?: string | null;
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

interface LoyaltyConfig {
    pointsPerCurrency: number;
    currencyPerPoint: number;
    minimumRedeemablePoints: number;
    earningRounding: 'down' | 'nearest' | 'up';
}

interface EmployeeTransactionsPageProps {
    ppnRate: number;
    productLookupUrl: string;
    storeUrl: string;
    recentTransactionId?: number | null;
    customerBaseUrl: string;
    customerLatestUrl: string;
    customerSearchUrl: string;
    customerStoreUrl: string;
    branding: BrandingInfo;
    loyaltyConfig: LoyaltyConfig;
}

interface CartItem extends TransactionProduct {
    quantity: number;
}

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const roundPoints = (value: number, mode: LoyaltyConfig['earningRounding']) => {
    switch (mode) {
        case 'up':
            return Math.ceil(value);
        case 'nearest':
            return Math.round(value);
        default:
            return Math.floor(value);
    }
};

type DiscountType = 'percentage' | 'value';
type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'e_wallet' | 'other';

const DISCOUNT_PERCENT_PRESETS = [5, 10, 15];

interface TransactionFormData {
    items: { product_id: number; quantity: number }[];
    customer_id: number | null;
    discount_type: DiscountType | null;
    discount_value: number | null;
    payment_method: PaymentMethod;
    amount_paid: number;
    notes: string;
    loyalty_points_to_redeem: number | null;
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
    customerSearchUrl,
    customerStoreUrl,
    branding,
    loyaltyConfig,
}: EmployeeTransactionsPageProps) {
    const { flash, storeSettings } = usePage<SharedData>().props;
    const locale = branding.language_code ?? storeSettings?.language_code ?? 'id-ID';
    const currencyCode = branding.currency_code ?? storeSettings?.currency_code ?? 'IDR';
    const currencyFormatter = useMemo(
        () =>
            new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: 2,
            }),
        [currencyCode, locale],
    );
    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
    const formatCurrency = (value: number) => currencyFormatter.format(value);
    const { currencyPerPoint, minimumRedeemablePoints, pointsPerCurrency, earningRounding } =
        loyaltyConfig;
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
    const [customerQuery, setCustomerQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
    const [customerResults, setCustomerResults] = useState<CustomerSummary[]>([]);
    const [customerSearchMessage, setCustomerSearchMessage] = useState<string | null>(null);
    const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
    const customerSearchAbortRef = useRef<AbortController | null>(null);
    const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
    const [enrollData, setEnrollData] = useState({
        name: '',
        email: '',
        phone: '',
        loyalty_number: '',
        notes: '',
    });
    const [enrollErrors, setEnrollErrors] = useState<Record<string, string[]>>({});
    const [enrollStatus, setEnrollStatus] = useState<string | null>(null);
    const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
    const [pointsToRedeemInput, setPointsToRedeemInput] = useState('');

    const itemControls = useTableControls(items, {
        searchFields: [
            (item) => item.name,
            (item) => item.barcode,
        ],
        filters: [
            { label: 'Semua item', value: 'all' },
            {
                label: 'Kuantitas > 1',
                value: 'bulk',
                predicate: (item) => item.quantity > 1,
            },
        ],
        initialPageSize: 8,
        pageSizeOptions: [5, 8, 12, 20],
    });

    const form = useForm<TransactionFormData>({
        items: [],
        customer_id: null,
        discount_type: null,
        discount_value: null,
        payment_method: 'cash',
        amount_paid: 0,
        notes: '',
        loyalty_points_to_redeem: null,
    });
    const { setData } = form;
    const lastCustomerIdRef = useRef<number | null>(form.data.customer_id ?? null);

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

    const cartItemCount = useMemo(
        () => items.reduce((count, item) => count + item.quantity, 0),
        [items],
    );

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

    const totalAfterDiscount = useMemo(
        () => roundCurrency(Math.max(totals.total - discountAmount, 0)),
        [totals.total, discountAmount],
    );

    const loyaltySummary = useMemo(() => {
        const availablePoints = selectedCustomer?.loyalty_points ?? 0;
        const requestedRaw = Number.parseInt(pointsToRedeemInput, 10);
        const requestedPoints = Number.isNaN(requestedRaw) ? 0 : Math.max(requestedRaw, 0);

        if (!selectedCustomer) {
            return {
                availablePoints,
                requestedPoints,
                effectivePoints: 0,
                redemptionValue: 0,
                netTotal: totalAfterDiscount,
                pointsEarned: 0,
            };
        }

        if (totalAfterDiscount <= 0 || currencyPerPoint <= 0) {
            const netTotal = totalAfterDiscount;
            const pointsEarned = pointsPerCurrency > 0
                ? roundPoints(netTotal * pointsPerCurrency, earningRounding)
                : 0;

            return {
                availablePoints,
                requestedPoints,
                effectivePoints: 0,
                redemptionValue: 0,
                netTotal,
                pointsEarned,
            };
        }

        let effectivePoints = Math.min(requestedPoints, availablePoints);
        const maxByValue = Math.floor(totalAfterDiscount / currencyPerPoint);
        if (maxByValue > 0) {
            effectivePoints = Math.min(effectivePoints, maxByValue);
        }

        if (effectivePoints < minimumRedeemablePoints) {
            effectivePoints = 0;
        }

        const redemptionValue = roundCurrency(effectivePoints * currencyPerPoint);
        const netTotal = roundCurrency(Math.max(totalAfterDiscount - redemptionValue, 0));
        const pointsEarned = pointsPerCurrency > 0
            ? roundPoints(netTotal * pointsPerCurrency, earningRounding)
            : 0;

        return {
            availablePoints,
            requestedPoints,
            effectivePoints,
            redemptionValue,
            netTotal,
            pointsEarned,
        };
    }, [
        currencyPerPoint,
        earningRounding,
        minimumRedeemablePoints,
        pointsPerCurrency,
        pointsToRedeemInput,
        selectedCustomer,
        totalAfterDiscount,
    ]);

    const amountDue = loyaltySummary.netTotal;
    const effectivePointsToRedeem = loyaltySummary.effectivePoints;
    const redemptionValue = loyaltySummary.redemptionValue;
    const estimatedPointsEarned = loyaltySummary.pointsEarned;
    const availableLoyaltyPoints = loyaltySummary.availablePoints;
    const requestedLoyaltyPoints = loyaltySummary.requestedPoints;

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

    const outstandingBalance = useMemo(
        () => roundCurrency(Math.max(amountDue - normalizedAmountPaid, 0)),
        [amountDue, normalizedAmountPaid],
    );

    const discountValuePresets = useMemo(() => {
        if (totals.total <= 0) {
            return [] as number[];
        }

        const fractions = [0.05, 0.1, 0.15];
        const values = fractions
            .map((fraction) => roundCurrency(totals.total * fraction))
            .filter((value) => value > 0 && value < totals.total);

        return Array.from(new Set(values));
    }, [totals.total]);

    const quickAmountPaidOptions = useMemo(() => {
        if (amountDue <= 0) {
            return [] as number[];
        }

        const base = roundCurrency(amountDue);
        const exponent = Math.max(Math.floor(Math.log10(base || 1)) - 1, 0);
        const step = Math.pow(10, exponent);
        const steps = [step, step * 2, step * 5];
        const values = new Set<number>([base]);

        steps.forEach((currentStep) => {
            if (currentStep <= 0) {
                return;
            }

            const rounded = roundCurrency(
                Math.ceil(base / currentStep) * currentStep,
            );
            values.add(rounded);
        });

        return Array.from(values)
            .filter((value) => value > 0)
            .sort((first, second) => first - second);
    }, [amountDue]);

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
        if (typeof window === 'undefined') {
            return;
        }

        const query = customerQuery.trim();

        customerSearchAbortRef.current?.abort();

        if (!customerSearchUrl) {
            return;
        }

        if (query === '') {
            setCustomerResults([]);
            setCustomerSearchMessage(null);
            setIsSearchingCustomers(false);
            return;
        }

        if (query.length < 2) {
            setCustomerResults([]);
            setCustomerSearchMessage('Masukkan minimal 2 karakter untuk mencari pelanggan.');
            setIsSearchingCustomers(false);
            return;
        }

        const controller = new AbortController();
        customerSearchAbortRef.current = controller;

        setIsSearchingCustomers(true);
        setCustomerSearchMessage('Mencari pelanggan...');

        const timeout = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    `${customerSearchUrl}?q=${encodeURIComponent(query)}`,
                    {
                        signal: controller.signal,
                        headers: {
                            Accept: 'application/json',
                        },
                    },
                );

                if (!response.ok) {
                    throw new Error('Unable to search customers');
                }

                const payload = (await response.json()) as { data: CustomerSummary[] };

                setCustomerResults(payload.data);
                setCustomerSearchMessage(
                    payload.data.length === 0
                        ? `Tidak ditemukan pelanggan untuk "${query}".`
                        : null,
                );
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }

                console.error(error);
                setCustomerResults([]);
                setCustomerSearchMessage('Tidak dapat memuat pelanggan saat ini. Coba lagi.');
            } finally {
                if (!controller.signal.aborted) {
                    setIsSearchingCustomers(false);
                }
            }
        }, 300);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [customerQuery, customerSearchUrl]);

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

    useEffect(() => {
        const nextCustomerId = selectedCustomer ? selectedCustomer.id : null;

        if (lastCustomerIdRef.current === nextCustomerId) {
            return;
        }

        lastCustomerIdRef.current = nextCustomerId;
        setData('customer_id', nextCustomerId);
    }, [selectedCustomer, setData]);

    useEffect(() => {
        setData('loyalty_points_to_redeem', effectivePointsToRedeem > 0 ? effectivePointsToRedeem : null);
    }, [effectivePointsToRedeem, setData]);

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

    const handleSelectCustomer = (customer: CustomerSummary) => {
        setSelectedCustomer(customer);
        setCustomerQuery(customer.name);
        setCustomerResults([]);
        setCustomerSearchMessage(null);
        setShowEnrollmentForm(false);
        setPointsToRedeemInput('');
    };

    const handleClearCustomer = () => {
        setSelectedCustomer(null);
        setCustomerQuery('');
        setCustomerResults([]);
        setCustomerSearchMessage(null);
        setPointsToRedeemInput('');
    };

    const handleEnrollmentInputChange = (
        field: keyof typeof enrollData,
        value: string,
    ) => {
        setEnrollData((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const resolveCsrfToken = (): string => {
        if (typeof document === 'undefined') {
            return '';
        }

        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;

        return meta?.content ?? '';
    };

    const handleEnrollSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!customerStoreUrl) {
            return;
        }

        setEnrollErrors({});
        setEnrollStatus(null);
        setIsSubmittingEnrollment(true);

        try {
            const response = await fetch(customerStoreUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': resolveCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify(enrollData),
            });

            if (response.status === 422) {
                const validation = await response.json();
                setEnrollErrors(validation.errors ?? {});
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to enroll customer');
            }

            const payload = (await response.json()) as {
                customer: CustomerSummary & { notes?: string | null };
            };

            const created: CustomerSummary = {
                id: payload.customer.id,
                name: payload.customer.name,
                email: payload.customer.email ?? null,
                phone: payload.customer.phone ?? null,
                loyalty_number: payload.customer.loyalty_number ?? null,
                loyalty_points: payload.customer.loyalty_points,
                enrolled_at: payload.customer.enrolled_at ?? null,
            };

            setSelectedCustomer(created);
            setCustomerQuery(created.name);
            setCustomerResults([]);
            setCustomerSearchMessage(null);
            setShowEnrollmentForm(false);
            setEnrollData({ name: '', email: '', phone: '', loyalty_number: '', notes: '' });
            setEnrollErrors({});
            setEnrollStatus('Pelanggan berhasil didaftarkan dan ditautkan ke transaksi.');
        } catch (error) {
            console.error(error);
            setEnrollStatus('Terjadi kesalahan saat mendaftarkan pelanggan. Coba lagi.');
        } finally {
            setIsSubmittingEnrollment(false);
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

    const handleQuickAmountPaid = (value: number) => {
        const rounded = roundCurrency(value);
        setAmountPaidInput(rounded.toFixed(2));
        form.setData('amount_paid', rounded);
    };

    const handleApplyPercentagePreset = (percentage: number) => {
        setDiscountType('percentage');
        setDiscountValueInput(percentage.toString());
        form.setData('discount_type', 'percentage');
        form.setData('discount_value', percentage);
    };

    const handleApplyValuePreset = (value: number) => {
        const bounded = Math.min(value, totals.total);
        setDiscountType('value');
        setDiscountValueInput(bounded.toFixed(2));
        form.setData('discount_type', 'value');
        form.setData('discount_value', roundCurrency(bounded));
    };

    const handleClearDiscount = () => {
        setDiscountType(null);
        setDiscountValueInput('');
        form.setData('discount_type', null);
        form.setData('discount_value', null);
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

        if (normalizedAmountPaid < amountDue) {
            form.setError(
                'amount_paid',
                'Amount paid must be at least the total due.',
            );
            return;
        }

        form.setData(
            'items',
            items.map((item) => ({
                product_id: item.id,
                quantity: item.quantity,
            })),
        );
        form.setData('customer_id', selectedCustomer ? selectedCustomer.id : null);
        form.setData('amount_paid', normalizedAmountPaid);

        form.post(storeUrl, {
            preserveScroll: true,
            onSuccess: () => {
                setItems([]);
                setDiscountType(null);
                setDiscountValueInput('');
                setPaymentMethod('cash');
                setAmountPaidInput('');
                setNotes('');
                setSelectedCustomer(null);
                setCustomerQuery('');
                setCustomerResults([]);
                setCustomerSearchMessage(null);
                setShowEnrollmentForm(false);
                setPointsToRedeemInput('');
                setEnrollData({ name: '', email: '', phone: '', loyalty_number: '', notes: '' });
                setEnrollErrors({});
                setEnrollStatus(null);
                form.reset();
            },
        });
    };

    useEffect(() => () => cleanupScanner(), []);
    useEffect(() => () => {
        customerSearchAbortRef.current?.abort();
    }, []);

    return (
        <AppLayout>
            <Head title="Point of Sale" />

            <div className="space-y-6 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-1 items-start gap-4">
                        {branding.logo_url && (
                            <img
                                src={branding.logo_url}
                                alt={`${branding.store_name ?? 'Store'} logo`}
                                className="h-16 w-auto rounded-md border border-border bg-white p-2 shadow-sm"
                            />
                        )}
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <h1 className="text-2xl font-semibold">
                                    {branding.store_name ?? 'Employee POS'}
                                </h1>
                                {branding.contact_details && (
                                    <p className="whitespace-pre-line text-sm text-muted-foreground">
                                        {branding.contact_details}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                                <p>Scan product barcodes or search manually to build a transaction.</p>
                                <p>
                                    Current PPN rate:{' '}
                                    <span className="font-medium text-foreground">{ppnRate}%</span>
                                </p>
                            </div>
                        </div>
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
                            <div className="space-y-4 p-4">
                                <TableToolbar
                                    searchTerm={itemControls.searchTerm}
                                    onSearchChange={itemControls.setSearchTerm}
                                    searchPlaceholder="Cari produk di keranjang"
                                    filterOptions={itemControls.filterOptions}
                                    filterValue={itemControls.filterValue}
                                    onFilterChange={itemControls.setFilterValue}
                                    pageSize={itemControls.pageSize}
                                    pageSizeOptions={itemControls.pageSizeOptions}
                                    onPageSizeChange={itemControls.setPageSize}
                                    total={itemControls.total}
                                    filteredTotal={itemControls.filteredTotal}
                                />

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
                                            {itemControls.total === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                                                        Scan a barcode or add a product manually to begin.
                                                    </td>
                                                </tr>
                                            ) : itemControls.filteredTotal === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                                                        Tidak ada item yang cocok dengan pencarian atau filter.
                                                    </td>
                                                </tr>
                                            ) : (
                                                itemControls.items.map((item) => {
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

                                <TablePagination
                                    page={itemControls.page}
                                    pageCount={itemControls.pageCount}
                                    onPageChange={itemControls.goToPage}
                                    range={itemControls.range}
                                    total={itemControls.total}
                                    filteredTotal={itemControls.filteredTotal}
                                />
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card className="space-y-4 p-4">
                            <h2 className="text-lg font-semibold">Transaction summary</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span>Items in cart</span>
                                    <span className="font-medium">
                                        {numberFormatter.format(cartItemCount)}
                                    </span>
                                </div>
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
                                    <span
                                        className={cn(
                                            'font-medium',
                                            discountAmount > 0
                                                ? 'text-destructive'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {discountAmount > 0
                                            ? `- ${formatCurrency(discountAmount)}`
                                            : formatCurrency(0)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Total after discounts</span>
                                    <span className="font-medium">
                                        {formatCurrency(totalAfterDiscount)}
                                    </span>
                                </div>
                                {redemptionValue > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span>Loyalty redemption</span>
                                        <span className="font-medium text-destructive">
                                            - {formatCurrency(redemptionValue)}
                                        </span>
                                    </div>
                                )}
                                <Separator className="my-2" />
                                <div className="flex items-center justify-between text-base font-semibold">
                                    <span>Amount due</span>
                                    <span
                                        className={cn(
                                            outstandingBalance > 0
                                                ? 'text-destructive'
                                                : 'text-foreground',
                                        )}
                                    >
                                        {formatCurrency(amountDue)}
                                    </span>
                                </div>
                                {outstandingBalance > 0 && (
                                    <div className="flex items-center justify-between text-sm text-destructive">
                                        <span>Outstanding</span>
                                        <span className="font-semibold">
                                            {formatCurrency(outstandingBalance)}
                                        </span>
                                    </div>
                                )}
                                {selectedCustomer && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span>Estimated points earned</span>
                                        <span className="font-medium text-foreground">
                                            {numberFormatter.format(estimatedPointsEarned)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span>Amount paid</span>
                                    <span className="font-medium">
                                        {formatCurrency(normalizedAmountPaid)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Change due</span>
                                    <span
                                        className={cn(
                                            'font-semibold',
                                            changeDue > 0
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-muted-foreground',
                                        )}
                                    >
                                        {formatCurrency(changeDue)}
                                    </span>
                                </div>
                            </div>
                        </Card>

                        <Card className="space-y-4 p-4">
                            <div>
                                <h3 className="text-lg font-semibold">Customer</h3>
                                <p className="text-sm text-muted-foreground">
                                    Connect this sale to a customer to track loyalty benefits.
                                </p>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="customer-search">Search customers</Label>
                                <Input
                                    id="customer-search"
                                    value={customerQuery}
                                    onChange={(event) => setCustomerQuery(event.target.value)}
                                    placeholder="Search by name, email, or phone"
                                    autoComplete="off"
                                />
                            </div>

                            {isSearchingCustomers && (
                                <p className="text-xs text-muted-foreground">Searching customers…</p>
                            )}

                            {customerSearchMessage && (
                                <p className="text-xs text-muted-foreground">{customerSearchMessage}</p>
                            )}

                            {customerResults.length > 0 && (
                                <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2 text-sm">
                                    {customerResults.map((customer) => (
                                        <li key={customer.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectCustomer(customer)}
                                                className="w-full rounded-md px-3 py-2 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                                            >
                                                <div className="font-medium text-foreground">{customer.name}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {[customer.email, customer.phone, customer.loyalty_number]
                                                        .filter(Boolean)
                                                        .join(' • ')}
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {selectedCustomer && (
                                <div className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-primary">
                                                {selectedCustomer.name}
                                            </div>
                                            <div className="space-y-0.5 text-xs text-muted-foreground">
                                                {selectedCustomer.email && <div>Email: {selectedCustomer.email}</div>}
                                                {selectedCustomer.phone && <div>Phone: {selectedCustomer.phone}</div>}
                                                {selectedCustomer.loyalty_number && (
                                                    <div>Loyalty ID: {selectedCustomer.loyalty_number}</div>
                                                )}
                                                <div>
                                                    Points balance:{' '}
                                                    {numberFormatter.format(selectedCustomer.loyalty_points)}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleClearCustomer}
                                        >
                                            Remove
                                        </Button>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="loyalty-redeem">Points to redeem (optional)</Label>
                                        <Input
                                            id="loyalty-redeem"
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            step={1}
                                            value={pointsToRedeemInput}
                                            onChange={(event) => setPointsToRedeemInput(event.target.value)}
                                            placeholder={minimumRedeemablePoints > 0
                                                ? `Min ${numberFormatter.format(minimumRedeemablePoints)}`
                                                : undefined}
                                            disabled={currencyPerPoint <= 0 || totalAfterDiscount <= 0}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Available: {numberFormatter.format(availableLoyaltyPoints)} pts
                                            {currencyPerPoint > 0 && (
                                                <>
                                                    {' '}
                                                    ({formatCurrency(availableLoyaltyPoints * currencyPerPoint)})
                                                </>
                                            )}
                                        </p>
                                        {effectivePointsToRedeem > 0 && (
                                            <p className="text-xs text-muted-foreground">
                                                Applying {numberFormatter.format(effectivePointsToRedeem)} pts saves{' '}
                                                {formatCurrency(redemptionValue)}.
                                            </p>
                                        )}
                                        {requestedLoyaltyPoints > 0 && effectivePointsToRedeem === 0 && minimumRedeemablePoints > 0 && (
                                            <p className="text-xs text-destructive">
                                                Enter at least {numberFormatter.format(minimumRedeemablePoints)} pts or ensure
                                                the purchase total is sufficient.
                                            </p>
                                        )}
                                        <InputError message={form.errors.loyalty_points_to_redeem} />
                                    </div>

                                    {estimatedPointsEarned > 0 && (
                                        <p className="text-xs text-muted-foreground">
                                            Estimated to earn {numberFormatter.format(estimatedPointsEarned)} pts on this
                                            sale.
                                        </p>
                                    )}
                                </div>
                            )}

                            <InputError message={form.errors.customer_id} />

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setEnrollStatus(null);
                                        setEnrollErrors({});
                                        setShowEnrollmentForm((value) => !value);
                                    }}
                                >
                                    {showEnrollmentForm ? 'Close enrollment' : 'Enroll new customer'}
                                </Button>
                                {selectedCustomer && (
                                    <span className="text-xs text-muted-foreground">
                                        Customer will be linked to this transaction.
                                    </span>
                                )}
                            </div>

                            {!showEnrollmentForm && enrollStatus && (
                                <p className="text-xs text-muted-foreground">{enrollStatus}</p>
                            )}

                            {showEnrollmentForm && (
                                <form
                                    className="space-y-3 rounded-md border border-dashed border-border p-4"
                                    onSubmit={handleEnrollSubmit}
                                >
                                    <div>
                                        <h4 className="text-sm font-semibold">New customer details</h4>
                                        <p className="text-xs text-muted-foreground">
                                            Enter contact information to enrol them in the loyalty program.
                                        </p>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="enroll-name">Full name</Label>
                                        <Input
                                            id="enroll-name"
                                            value={enrollData.name}
                                            onChange={(event) =>
                                                handleEnrollmentInputChange('name', event.target.value)
                                            }
                                            required
                                        />
                                        <InputError message={enrollErrors.name?.[0]} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="enroll-email">Email</Label>
                                        <Input
                                            id="enroll-email"
                                            type="email"
                                            value={enrollData.email}
                                            onChange={(event) =>
                                                handleEnrollmentInputChange('email', event.target.value)
                                            }
                                        />
                                        <InputError message={enrollErrors.email?.[0]} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="enroll-phone">Phone</Label>
                                        <Input
                                            id="enroll-phone"
                                            value={enrollData.phone}
                                            onChange={(event) =>
                                                handleEnrollmentInputChange('phone', event.target.value)
                                            }
                                        />
                                        <InputError message={enrollErrors.phone?.[0]} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="enroll-loyalty">Loyalty number</Label>
                                        <Input
                                            id="enroll-loyalty"
                                            value={enrollData.loyalty_number}
                                            onChange={(event) =>
                                                handleEnrollmentInputChange('loyalty_number', event.target.value)
                                            }
                                        />
                                        <InputError message={enrollErrors.loyalty_number?.[0]} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="enroll-notes">Notes</Label>
                                        <textarea
                                            id="enroll-notes"
                                            value={enrollData.notes}
                                            onChange={(event) =>
                                                handleEnrollmentInputChange('notes', event.target.value)
                                            }
                                            className="min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
                                        />
                                        <InputError message={enrollErrors.notes?.[0]} />
                                    </div>

                                    {enrollStatus && (
                                        <p className="text-xs text-muted-foreground">{enrollStatus}</p>
                                    )}

                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            type="submit"
                                            size="sm"
                                            disabled={isSubmittingEnrollment}
                                        >
                                            {isSubmittingEnrollment ? 'Saving…' : 'Save customer'}
                                        </Button>
                                    </div>
                                </form>
                            )}
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
                                    {totals.total > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground">
                                                Quick discount presets
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {DISCOUNT_PERCENT_PRESETS.map((percentage) => (
                                                    <Button
                                                        key={`percentage-${percentage}`}
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            handleApplyPercentagePreset(percentage)
                                                        }
                                                    >
                                                        {percentage}% off
                                                    </Button>
                                                ))}
                                                {discountValuePresets.map((value) => (
                                                    <Button
                                                        key={`value-${value}`}
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleApplyValuePreset(value)}
                                                    >
                                                        -{formatCurrency(value)}
                                                    </Button>
                                                ))}
                                                {(discountType || discountValueInput) && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={handleClearDiscount}
                                                    >
                                                        Clear discount
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
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
                                        {quickAmountPaidOptions.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                                {quickAmountPaidOptions.map((option) => {
                                                    const isExact =
                                                        Math.abs(option - amountDue) < 0.01;

                                                    return (
                                                        <Button
                                                            key={`cash-${option}`}
                                                            type="button"
                                                            size="sm"
                                                            variant={isExact ? 'secondary' : 'outline'}
                                                            onClick={() => handleQuickAmountPaid(option)}
                                                        >
                                                            {isExact
                                                                ? `Exact (${formatCurrency(option)})`
                                                                : formatCurrency(option)}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {outstandingBalance > 0 && (
                                            <p className="text-xs font-medium text-destructive">
                                                Outstanding balance: {formatCurrency(outstandingBalance)}
                                            </p>
                                        )}
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
