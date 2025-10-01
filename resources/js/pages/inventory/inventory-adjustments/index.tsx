import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import {
    ArrowLeftRight,
    Boxes,
    History,
    ListPlus,
    PackageSearch,
    Trash2,
} from 'lucide-react';

interface InventoryLocationSummary {
    id: number;
    name: string;
    code: string;
    is_default: boolean;
}

interface ProductInventoryLevel {
    inventory_location_id: number;
    quantity: number;
}

interface ProductSummary {
    id: number;
    name: string;
    barcode: string;
    stock: number;
    inventory_levels: ProductInventoryLevel[];
}

interface RecentAdjustmentSummary {
    id: number;
    quantity_delta: number;
    reason: string;
    notes: string | null;
    created_at: string | null;
    product: {
        id: number;
        name: string;
        barcode: string;
        stock: number;
    };
    location: {
        id: number;
        name: string;
        code: string;
    };
    user: {
        id: number;
        name: string;
    };
}

interface InventoryAdjustmentsPageProps {
    inventoryLocations: InventoryLocationSummary[];
    products: ProductSummary[];
    recentAdjustments: RecentAdjustmentSummary[];
}

interface DraftAdjustment {
    productId: string;
    quantityDelta: string;
    reason: string;
    notes: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory Adjustments',
        href: '/inventory/adjustments',
    },
];

const formatDate = (value: string | null): string => {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString();
};

export default function InventoryAdjustmentsIndex({
    inventoryLocations,
    products,
    recentAdjustments,
}: InventoryAdjustmentsPageProps) {
    const { flash } = usePage<SharedData>().props;

    const defaultLocationId = useMemo(() => {
        const preferred = inventoryLocations.find((location) => location.is_default);

        return preferred?.id.toString() ?? inventoryLocations[0]?.id.toString() ?? '';
    }, [inventoryLocations]);

    const form = useForm<{
        location_id: string;
        adjustments: { product_id: number; quantity_delta: number; reason: string; notes: string }[];
    }>({
        location_id: defaultLocationId,
        adjustments: [],
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [draft, setDraft] = useState<DraftAdjustment>({
        productId: '',
        quantityDelta: '',
        reason: '',
        notes: '',
    });

    const selectedProduct = useMemo(() => {
        if (!draft.productId) {
            return undefined;
        }

        const id = Number.parseInt(draft.productId, 10);

        if (Number.isNaN(id)) {
            return undefined;
        }

        return products.find((product) => product.id === id);
    }, [draft.productId, products]);

    const selectedLocationQuantity = useMemo(() => {
        if (!selectedProduct) {
            return 0;
        }

        const locationId = Number.parseInt(form.data.location_id, 10);

        if (Number.isNaN(locationId)) {
            return 0;
        }

        return (
            selectedProduct.inventory_levels.find(
                (level) => level.inventory_location_id === locationId,
            )?.quantity ?? 0
        );
    }, [form.data.location_id, selectedProduct]);

    const filteredProducts = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        if (!term) {
            return products.slice(0, 25);
        }

        return products
            .filter((product) => {
                return (
                    product.name.toLowerCase().includes(term) ||
                    product.barcode.toLowerCase().includes(term)
                );
            })
            .slice(0, 25);
    }, [products, searchTerm]);

    const adjustmentErrors = useMemo(() => {
        return Object.entries(form.errors)
            .filter(([key]) => key.startsWith('adjustments'))
            .map(([, message]) => message);
    }, [form.errors]);

    const handleLocationChange = (value: string) => {
        form.setData('location_id', value);
    };

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleDraftChange = <Field extends keyof DraftAdjustment>(
        field: Field,
        value: DraftAdjustment[Field],
    ) => {
        setDraft((current) => ({ ...current, [field]: value }));
    };

    const handleAddAdjustment = () => {
        if (!draft.productId) {
            return;
        }

        const quantity = Number.parseInt(draft.quantityDelta, 10);

        if (!Number.isFinite(quantity) || quantity === 0) {
            return;
        }

        const productId = Number.parseInt(draft.productId, 10);

        if (Number.isNaN(productId)) {
            return;
        }

        const next = [
            ...form.data.adjustments,
            {
                product_id: productId,
                quantity_delta: quantity,
                reason: draft.reason.trim() || 'manual adjustment',
                notes: draft.notes.trim(),
            },
        ];

        form.setData('adjustments', next);
        setDraft({ productId: draft.productId, quantityDelta: '', reason: '', notes: '' });
    };

    const handleRemoveAdjustment = (index: number) => {
        const next = form.data.adjustments.filter((_, idx) => idx !== index);
        form.setData('adjustments', next);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (form.data.adjustments.length === 0) {
            return;
        }

        form.post('/inventory/adjustments', {
            preserveScroll: true,
            onSuccess: () => {
                form.setData('adjustments', []);
                setDraft({ productId: '', quantityDelta: '', reason: '', notes: '' });
                setSearchTerm('');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inventory Adjustments" />

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

                <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Card className="shadow-sm">
                            <CardHeader className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <ListPlus className="h-5 w-5" />
                                    <CardTitle>Record adjustments</CardTitle>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Choose a location, select the products you counted, and log the variance with a reason for audit tracking.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="location">Inventory location</Label>
                                    <Select
                                        value={form.data.location_id}
                                        onValueChange={handleLocationChange}
                                    >
                                        <SelectTrigger id="location">
                                            <SelectValue placeholder="Select location" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {inventoryLocations.map((location) => (
                                                <SelectItem key={location.id} value={location.id.toString()}>
                                                    {location.name} ({location.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={form.errors.location_id} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="product-search">Find a product</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="product-search"
                                            value={searchTerm}
                                            onChange={handleSearchChange}
                                            placeholder="Search by name or barcode"
                                            autoComplete="off"
                                        />
                                        <PackageSearch className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="max-h-56 overflow-y-auto rounded-md border border-border/60 bg-background">
                                        {filteredProducts.length === 0 && (
                                            <p className="p-3 text-sm text-muted-foreground">
                                                No products matched your search.
                                            </p>
                                        )}

                                        {filteredProducts.map((product) => {
                                            const isSelected = draft.productId === product.id.toString();

                                            return (
                                                <Button
                                                    key={product.id}
                                                    type="button"
                                                    variant={isSelected ? 'secondary' : 'ghost'}
                                                    className="h-auto w-full justify-between px-3 py-2"
                                                    onClick={() =>
                                                        handleDraftChange('productId', product.id.toString())
                                                    }
                                                >
                                                    <span className="flex flex-col items-start">
                                                        <span className="text-sm font-medium">{product.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {product.barcode || '—'}
                                                        </span>
                                                    </span>
                                                    <Badge variant="outline">{product.stock} on hand</Badge>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {selectedProduct && (
                                    <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Boxes className="h-4 w-4" />
                                            <span>
                                                {selectedProduct.name} currently has
                                                <span className="mx-1 font-semibold text-foreground">
                                                    {selectedLocationQuantity}
                                                </span>
                                                units at this location (global stock {selectedProduct.stock}).
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="quantity-delta">Quantity change</Label>
                                        <Input
                                            id="quantity-delta"
                                            value={draft.quantityDelta}
                                            onChange={(event) =>
                                                handleDraftChange('quantityDelta', event.target.value)
                                            }
                                            placeholder="e.g. -3 or 5"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="reason">Reason</Label>
                                        <Input
                                            id="reason"
                                            value={draft.reason}
                                            onChange={(event) => handleDraftChange('reason', event.target.value)}
                                            placeholder="Damaged, cycle count, etc."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes">Notes (optional)</Label>
                                    <Input
                                        id="notes"
                                        value={draft.notes}
                                        onChange={(event) => handleDraftChange('notes', event.target.value)}
                                        placeholder="Add context for the adjustment"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setDraft({ productId: '', quantityDelta: '', reason: '', notes: '' })}
                                    >
                                        <ArrowLeftRight className="mr-2 h-4 w-4" />Reset selection
                                    </Button>
                                    <Button type="button" onClick={handleAddAdjustment}>
                                        <ListPlus className="mr-2 h-4 w-4" />
                                        Add to batch
                                    </Button>
                                </div>

                                {adjustmentErrors.length > 0 && (
                                    <div className="space-y-2 rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm text-destructive">
                                        {adjustmentErrors.map((message, index) => (
                                            <p key={`${message}-${index}`}>{message}</p>
                                        ))}
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <History className="h-4 w-4" />
                                        <span className="text-sm font-semibold">Pending adjustments</span>
                                    </div>
                                    {form.data.adjustments.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            Add products above to prepare a batch adjustment.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {form.data.adjustments.map((adjustment, index) => {
                                                const product = products.find(
                                                    (candidate) => candidate.id === adjustment.product_id,
                                                );

                                                return (
                                                    <div
                                                        key={`${adjustment.product_id}-${index}`}
                                                        className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2"
                                                    >
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-medium">
                                                                {product?.name ?? 'Unknown product'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {adjustment.quantity_delta > 0 ? '+' : ''}
                                                                {adjustment.quantity_delta} &middot; {adjustment.reason}
                                                                {adjustment.notes && ` — ${adjustment.notes}`}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRemoveAdjustment(index)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-end">
                                    <Button type="submit" disabled={form.processing || form.data.adjustments.length === 0}>
                                        <ArrowLeftRight className="mr-2 h-4 w-4" />
                                        Post adjustments
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>

                    <div className="space-y-4">
                        <Card className="shadow-sm">
                            <CardHeader className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <History className="h-5 w-5" />
                                    <CardTitle>Recent activity</CardTitle>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    The 50 most recent adjustments across all locations.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {recentAdjustments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No adjustments have been recorded yet.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {recentAdjustments.map((adjustment) => (
                                            <div
                                                key={adjustment.id}
                                                className="rounded-md border border-border/60 bg-background p-3"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold">
                                                            {adjustment.product.name}
                                                            <span className="ml-2 text-xs text-muted-foreground">
                                                                {adjustment.product.barcode || '—'}
                                                            </span>
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatDate(adjustment.created_at)} &middot; {adjustment.user.name}
                                                        </p>
                                                    </div>
                                                    <Badge variant={adjustment.quantity_delta >= 0 ? 'secondary' : 'destructive'}>
                                                        {adjustment.quantity_delta > 0 ? '+' : ''}
                                                        {adjustment.quantity_delta}
                                                    </Badge>
                                                </div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <Boxes className="h-3 w-3" />
                                                        {adjustment.location.name} ({adjustment.location.code})
                                                    </span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {adjustment.reason}
                                                    </Badge>
                                                    {adjustment.notes && <span>— {adjustment.notes}</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
