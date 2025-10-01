import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
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
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import {
    Boxes,
    CheckCircle2,
    ClipboardList,
    PackagePlus,
    RefreshCcw,
    Truck,
} from 'lucide-react';

interface SupplierSummary {
    id: number;
    name: string;
    lead_time_days?: number;
}

interface SuggestionProduct {
    id: number;
    name: string;
    barcode: string;
    current_stock: number;
    reorder_point: number;
    reorder_quantity: number | null;
    suggested_quantity: number;
    cost_price: string | number | null;
}

interface SuggestionGroup {
    supplier: SupplierSummary | null;
    products: SuggestionProduct[];
}

interface PurchaseOrderItemSummary {
    id: number;
    product: {
        id: number;
        name: string;
        barcode: string;
    };
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: string | number | null;
    notes: string | null;
    is_fulfilled: boolean;
}

interface PurchaseOrderSummary {
    id: number;
    reference: string;
    status: string;
    expected_date: string | null;
    ordered_at: string | null;
    received_at: string | null;
    total_cost: string | number;
    notes: string | null;
    is_receivable: boolean;
    supplier: SupplierSummary | null;
    items: PurchaseOrderItemSummary[];
}

interface InventoryLocationSummary {
    id: number;
    name: string;
    code: string;
    is_default: boolean;
}

interface PurchaseOrdersPageProps {
    purchaseOrders: PurchaseOrderSummary[];
    suggestions: SuggestionGroup[];
    inventoryLocations: InventoryLocationSummary[];
    defaultReorderPoint: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Purchase Orders',
        href: '/inventory/purchase-orders',
    },
];

const formatCurrency = (value: string | number): string => {
    const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;

    if (Number.isNaN(numeric)) {
        return '0.00';
    }

    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(numeric);
};

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'ordered':
            return 'secondary';
        case 'partial':
            return 'outline';
        case 'received':
            return 'default';
        case 'cancelled':
            return 'destructive';
        default:
            return 'outline';
    }
};

const formatDateTime = (value: string | null): string => {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString();
};

export default function PurchaseOrdersIndex({
    purchaseOrders,
    suggestions,
    inventoryLocations,
}: PurchaseOrdersPageProps) {
    const { flash } = usePage<SharedData>().props;
    const [orderBeingReceived, setOrderBeingReceived] = useState<PurchaseOrderSummary | null>(
        null,
    );
    const [isReceiveOpen, setIsReceiveOpen] = useState(false);

    const [suggestionLines, setSuggestionLines] = useState<Record<
        number,
        { quantity: string; unit_cost: string }
    >>({});

    const defaultLocationId = useMemo(() => {
        const preferred = inventoryLocations.find((location) => location.is_default);
        return preferred?.id.toString() ?? inventoryLocations[0]?.id.toString() ?? '';
    }, [inventoryLocations]);

    useEffect(() => {
        const initial: Record<number, { quantity: string; unit_cost: string }> = {};

        suggestions.forEach((group) => {
            group.products.forEach((product) => {
                initial[product.id] = {
                    quantity: product.suggested_quantity.toString(),
                    unit_cost:
                        product.cost_price !== null ? product.cost_price.toString() : '',
                };
            });
        });

        setSuggestionLines(initial);
    }, [suggestions]);

    const createOrderForm = useForm<{
        supplier_id: string;
        expected_date: string;
        notes: string;
        items: { product_id: number; quantity: number; unit_cost: string }[];
    }>({
        supplier_id: '',
        expected_date: '',
        notes: '',
        items: [],
    });

    const receiveForm = useForm<{
        location_id: string;
        items: { id: number; quantity_received: string; lot_number: string; expires_at: string }[];
    }>({
        location_id: defaultLocationId,
        items: [],
    });

    const deleteOrderForm = useForm({});

    const createOrderItemError = useMemo(() => {
        if (createOrderForm.errors.items) {
            return createOrderForm.errors.items as string;
        }

        const nested = Object.entries(createOrderForm.errors).find(([key]) =>
            key.startsWith('items.'),
        );

        return (nested?.[1] as string | undefined) ?? undefined;
    }, [createOrderForm.errors]);

    const receiveFormItemError = useMemo(() => {
        if (receiveForm.errors.items) {
            return receiveForm.errors.items as string;
        }

        const nested = Object.entries(receiveForm.errors).find(([key]) =>
            key.startsWith('items.'),
        );

        return (nested?.[1] as string | undefined) ?? undefined;
    }, [receiveForm.errors]);

    const handleSuggestionChange = (
        productId: number,
        field: 'quantity' | 'unit_cost',
        value: string,
    ) => {
        setSuggestionLines((current) => ({
            ...current,
            [productId]: {
                ...current[productId],
                [field]: value,
            },
        }));
    };

    const handleCreateOrder = (group: SuggestionGroup) => {
        if (!group.supplier) {
            window.alert(
                'Assign a supplier to these products before generating a purchase order.',
            );
            return;
        }

        const items = group.products
            .map((product) => {
                const line = suggestionLines[product.id];
                const quantity = Number.parseInt(line?.quantity ?? '0', 10);

                return {
                    product_id: product.id,
                    quantity: Number.isNaN(quantity) ? product.suggested_quantity : quantity,
                    unit_cost: line?.unit_cost ?? '',
                };
            })
            .filter((item) => item.quantity > 0);

        if (items.length === 0) {
            window.alert('Quantities must be greater than zero to create a purchase order.');
            return;
        }

        createOrderForm.setData((data) => ({
            ...data,
            supplier_id: group.supplier!.id.toString(),
            items,
        }));

        createOrderForm.post('/inventory/purchase-orders', {
            preserveScroll: true,
            onSuccess: () => {
                createOrderForm.reset();
            },
        });
    };

    const handleReceiveDialogChange = (order: PurchaseOrderSummary) => (open: boolean) => {
        setIsReceiveOpen(open);

        if (open) {
            setOrderBeingReceived(order);
            receiveForm.setData({
                location_id: defaultLocationId,
                items: order.items.map((item) => ({
                    id: item.id,
                    quantity_received: Math.max(
                        item.quantity_ordered - item.quantity_received,
                        0,
                    ).toString(),
                    lot_number: '',
                    expires_at: '',
                })),
            });
            receiveForm.clearErrors();
            return;
        }

        setOrderBeingReceived(null);
        receiveForm.reset();
        receiveForm.setData('location_id', defaultLocationId);
        receiveForm.clearErrors();
    };

    const handleReceiveSubmit = () => {
        if (!orderBeingReceived) {
            return;
        }

        receiveForm.post(`/inventory/purchase-orders/${orderBeingReceived.id}/receive`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsReceiveOpen(false);
                setOrderBeingReceived(null);
                receiveForm.reset();
                receiveForm.setData('location_id', defaultLocationId);
            },
        });
    };

    const handleDeleteOrder = (order: PurchaseOrderSummary) => {
        if (!window.confirm(`Delete purchase order ${order.reference}?`)) {
            return;
        }

        deleteOrderForm.delete(`/inventory/purchase-orders/${order.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Purchase Orders" />

            <div className="space-y-6 p-4">
                {flash?.success && (
                    <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100">
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                {flash?.error && (
                    <Alert className="border-red-200 bg-red-50 text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
                        <AlertTitle>Action required</AlertTitle>
                        <AlertDescription>{flash.error}</AlertDescription>
                    </Alert>
                )}

                <div className="grid gap-6 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                    <div className="space-y-6">
                        <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                            <header className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <PackagePlus className="h-5 w-5" />
                                    <h2 className="text-lg font-semibold">Reorder suggestions</h2>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Generate purchase orders for products that have fallen below their reorder point.
                                </p>
                            </header>

                            {suggestions.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                                    <CheckCircle2 className="h-8 w-8" />
                                    <p>All products are above their reorder points. Nice work!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {suggestions.map((group, index) => (
                                        <div
                                            key={group.supplier?.id ?? `unassigned-${index}`}
                                            className="space-y-3 rounded-lg border border-border/80 bg-background/60 p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <h3 className="text-base font-semibold">
                                                        {group.supplier ? group.supplier.name : 'Unassigned supplier'}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        {group.supplier
                                                            ? (() => {
                                                                  const leadTime = group.supplier?.lead_time_days ?? 0;
                                                                  return `Lead time: ${leadTime} day${leadTime === 1 ? '' : 's'}`;
                                                              })()
                                                            : 'Assign these products to a supplier to enable automated purchasing.'}
                                                    </p>
                                                </div>
                                                <Badge variant="outline">{group.products.length} products</Badge>
                                            </div>

                                            <div className="space-y-2">
                                                {group.products.map((product) => {
                                                    const line = suggestionLines[product.id];

                                                    return (
                                                        <div
                                                            key={product.id}
                                                            className="rounded-md border border-border/60 p-3"
                                                        >
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div>
                                                                    <p className="font-medium">{product.name}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Barcode: {product.barcode}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right text-xs text-muted-foreground">
                                                                    <div>Current stock: {product.current_stock}</div>
                                                                    <div>
                                                                        Reorder point: {product.reorder_point}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                                <div className="space-y-1">
                                                                    <Label htmlFor={`suggestion-qty-${product.id}`}>
                                                                        Quantity to order
                                                                    </Label>
                                                                    <Input
                                                                        id={`suggestion-qty-${product.id}`}
                                                                        type="number"
                                                                        min={0}
                                                                        value={line?.quantity ?? product.suggested_quantity.toString()}
                                                                        onChange={(event) =>
                                                                            handleSuggestionChange(
                                                                                product.id,
                                                                                'quantity',
                                                                                event.target.value,
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <Label htmlFor={`suggestion-cost-${product.id}`}>
                                                                        Unit cost
                                                                    </Label>
                                                                    <Input
                                                                        id={`suggestion-cost-${product.id}`}
                                                                        type="number"
                                                                        min={0}
                                                                        step="0.01"
                                                                        value={line?.unit_cost ?? ''}
                                                                        onChange={(event) =>
                                                                            handleSuggestionChange(
                                                                                product.id,
                                                                                'unit_cost',
                                                                                event.target.value,
                                                                            )
                                                                        }
                                                                        placeholder="Optional"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <Button
                                                type="button"
                                                className="w-full"
                                                onClick={() => handleCreateOrder(group)}
                                                disabled={createOrderForm.processing || !group.supplier}
                                            >
                                                <ClipboardList className="mr-2 h-4 w-4" /> Generate purchase order
                                            </Button>

                                            {createOrderItemError && (
                                                <InputError message={createOrderItemError} />
                                            )}
                                            {createOrderForm.errors.supplier_id && (
                                                <InputError message={createOrderForm.errors.supplier_id} />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Purchase order workflow</h2>
                                <p className="text-sm text-muted-foreground">
                                    Track outstanding orders, receive inventory and maintain lot traceability.
                                </p>
                            </div>
                        </header>

                        <div className="space-y-4">
                            {purchaseOrders.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                                    <Truck className="h-8 w-8" />
                                    <p>No purchase orders yet. Generate one from the suggestions panel.</p>
                                </div>
                            ) : (
                                purchaseOrders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="space-y-4 rounded-lg border border-border/80 bg-background/80 p-5 shadow-sm"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-base font-semibold">{order.reference}</h3>
                                                    <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Supplier:{' '}
                                                    {order.supplier ? order.supplier.name : 'Unassigned'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Ordered {formatDateTime(order.ordered_at)}
                                                </p>
                                            </div>
                                            <div className="text-right text-sm">
                                                <p className="font-semibold">
                                                    {formatCurrency(order.total_cost)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {order.items.length} line item{order.items.length === 1 ? '' : 's'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[520px] text-sm">
                                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                                    <tr>
                                                        <th className="px-3 py-2">Product</th>
                                                        <th className="px-3 py-2 text-right">Ordered</th>
                                                        <th className="px-3 py-2 text-right">Received</th>
                                                        <th className="px-3 py-2 text-right">Unit cost</th>
                                                        <th className="px-3 py-2">Notes</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items.map((item) => (
                                                        <tr key={item.id} className="border-b border-muted/40 last:border-b-0">
                                                            <td className="px-3 py-2">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="font-medium">{item.product.name}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {item.product.barcode}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 text-right">{item.quantity_ordered}</td>
                                                            <td className="px-3 py-2 text-right">
                                                                <span
                                                                    className={
                                                                        item.is_fulfilled
                                                                            ? 'text-green-600 dark:text-green-400'
                                                                            : 'text-muted-foreground'
                                                                    }
                                                                >
                                                                    {item.quantity_received}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-2 text-right">
                                                                {item.unit_cost !== null
                                                                    ? formatCurrency(item.unit_cost)
                                                                    : '—'}
                                                            </td>
                                                            <td className="px-3 py-2 text-sm text-muted-foreground">
                                                                {item.notes ?? '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Boxes className="h-4 w-4" />
                                                    <span>
                                                        {order.items.reduce(
                                                            (carry, item) =>
                                                                carry + (item.quantity_ordered - item.quantity_received),
                                                            0,
                                                        )}{' '}
                                                        units remaining
                                                    </span>
                                                </div>
                                                {order.received_at && (
                                                    <div className="flex items-center gap-1">
                                                        <RefreshCcw className="h-4 w-4" />
                                                        <span>Received {formatDateTime(order.received_at)}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {order.is_receivable && (
                                                    <Dialog
                                                        open={
                                                            isReceiveOpen &&
                                                            orderBeingReceived?.id === order.id
                                                        }
                                                        onOpenChange={handleReceiveDialogChange(order)}
                                                    >
                                                        <DialogTrigger asChild>
                                                            <Button variant="outline">
                                                                Receive inventory
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent className="sm:max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle>Receive inventory</DialogTitle>
                                                                <DialogDescription>
                                                                    Log received quantities and lot details for {order.reference}.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-4">
                                                                <div className="space-y-2">
                                                                    <Label htmlFor="receive-location">Location</Label>
                                                                    <Select
                                                                        value={receiveForm.data.location_id}
                                                                        onValueChange={(value) =>
                                                                            receiveForm.setData('location_id', value)
                                                                        }
                                                                    >
                                                                        <SelectTrigger id="receive-location">
                                                                            <SelectValue placeholder="Select a location" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {inventoryLocations.map((location) => (
                                                                                <SelectItem
                                                                                    key={location.id}
                                                                                    value={location.id.toString()}
                                                                                >
                                                                                    {location.name}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <InputError message={receiveForm.errors.location_id} />
                                                                </div>

                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full min-w-[520px] text-sm">
                                                                        <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                                                            <tr>
                                                                                <th className="px-3 py-2">Product</th>
                                                                                <th className="px-3 py-2 text-right">Receive</th>
                                                                                <th className="px-3 py-2">Lot number</th>
                                                                                <th className="px-3 py-2">Expiry</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {receiveForm.data.items.map((item, index) => (
                                                                                <tr key={item.id} className="border-b border-muted/40 last:border-b-0">
                                                                                    <td className="px-3 py-2">
                                                                                        {order.items[index]?.product.name ?? 'Product'}
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-right">
                                                                                        <Input
                                                                                            type="number"
                                                                                            min={0}
                                                                                            value={item.quantity_received}
                                                                                            onChange={(event) => {
                                                                                                const value = event.target.value;
                                                                                                receiveForm.setData((data) => {
                                                                                                    const next = [...data.items];
                                                                                                    next[index] = {
                                                                                                        ...next[index],
                                                                                                        quantity_received: value,
                                                                                                    };
                                                                                                    return {
                                                                                                        ...data,
                                                                                                        items: next,
                                                                                                    };
                                                                                                });
                                                                                            }}
                                                                                        />
                                                                                    </td>
                                                                                    <td className="px-3 py-2">
                                                                                        <Input
                                                                                            value={item.lot_number}
                                                                                            onChange={(event) => {
                                                                                                const value = event.target.value;
                                                                                                receiveForm.setData((data) => {
                                                                                                    const next = [...data.items];
                                                                                                    next[index] = {
                                                                                                        ...next[index],
                                                                                                        lot_number: value,
                                                                                                    };
                                                                                                    return {
                                                                                                        ...data,
                                                                                                        items: next,
                                                                                                    };
                                                                                                });
                                                                                            }}
                                                                                            placeholder={`${order.reference}-${item.id}`}
                                                                                        />
                                                                                    </td>
                                                                                    <td className="px-3 py-2">
                                                                                        <Input
                                                                                            type="date"
                                                                                            value={item.expires_at}
                                                                                            onChange={(event) => {
                                                                                                const value = event.target.value;
                                                                                                receiveForm.setData((data) => {
                                                                                                    const next = [...data.items];
                                                                                                    next[index] = {
                                                                                                        ...next[index],
                                                                                                        expires_at: value,
                                                                                                    };
                                                                                                    return {
                                                                                                        ...data,
                                                                                                        items: next,
                                                                                                    };
                                                                                                });
                                                                                            }}
                                                                                        />
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>

                                                                {receiveFormItemError && (
                                                                    <InputError message={receiveFormItemError} />
                                                                )}
                                                            </div>

                                                            <DialogFooter>
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    onClick={() => setIsReceiveOpen(false)}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    onClick={handleReceiveSubmit}
                                                                    disabled={receiveForm.processing}
                                                                >
                                                                    Receive stock
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}

                                                <Button
                                                    variant="destructive"
                                                    onClick={() => handleDeleteOrder(order)}
                                                    disabled={deleteOrderForm.processing}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}
