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
import { ArrowLeftRight, Boxes, History, PackageSearch } from 'lucide-react';

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

interface RecentTransferSummary {
    id: number;
    quantity: number;
    created_at: string | null;
    product: {
        id: number;
        name: string;
        barcode: string;
    };
    source: {
        id: number;
        name: string;
        code: string;
    };
    destination: {
        id: number;
        name: string;
        code: string;
    };
    user: {
        id: number;
        name: string;
    };
}

interface InventoryTransfersPageProps {
    inventoryLocations: InventoryLocationSummary[];
    products: ProductSummary[];
    recentTransfers: RecentTransferSummary[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Inventory Transfers',
        href: '/inventory/transfers',
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

export default function InventoryTransfersIndex({
    inventoryLocations,
    products,
    recentTransfers,
}: InventoryTransfersPageProps) {
    const { flash } = usePage<SharedData>().props;

    const defaultSourceId = useMemo(() => {
        const preferred = inventoryLocations.find((location) => location.is_default);

        return preferred?.id.toString() ?? inventoryLocations[0]?.id.toString() ?? '';
    }, [inventoryLocations]);

    const defaultDestinationId = useMemo(() => {
        if (inventoryLocations.length <= 1) {
            return '';
        }

        const sourceNumeric = Number.parseInt(defaultSourceId, 10);
        const fallback = inventoryLocations.find((location) => location.id !== sourceNumeric) ?? inventoryLocations[0];

        return fallback?.id.toString() ?? '';
    }, [defaultSourceId, inventoryLocations]);

    const form = useForm<{
        source_location_id: string;
        destination_location_id: string;
        product_id: string;
        quantity: string;
    }>({
        source_location_id: defaultSourceId,
        destination_location_id: defaultDestinationId,
        product_id: '',
        quantity: '1',
    });

    const [searchTerm, setSearchTerm] = useState('');

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

    const selectedProduct = useMemo(() => {
        if (!form.data.product_id) {
            return undefined;
        }

        const productId = Number.parseInt(form.data.product_id, 10);

        if (Number.isNaN(productId)) {
            return undefined;
        }

        return products.find((product) => product.id === productId);
    }, [form.data.product_id, products]);

    const sourceQuantity = useMemo(() => {
        if (!selectedProduct) {
            return 0;
        }

        const sourceId = Number.parseInt(form.data.source_location_id, 10);

        if (Number.isNaN(sourceId)) {
            return 0;
        }

        return (
            selectedProduct.inventory_levels.find(
                (level) => level.inventory_location_id === sourceId,
            )?.quantity ?? 0
        );
    }, [form.data.source_location_id, selectedProduct]);

    const destinationQuantity = useMemo(() => {
        if (!selectedProduct) {
            return 0;
        }

        const destinationId = Number.parseInt(form.data.destination_location_id, 10);

        if (Number.isNaN(destinationId)) {
            return 0;
        }

        return (
            selectedProduct.inventory_levels.find(
                (level) => level.inventory_location_id === destinationId,
            )?.quantity ?? 0
        );
    }, [form.data.destination_location_id, selectedProduct]);

    const handleSourceChange = (value: string) => {
        form.setData('source_location_id', value);
    };

    const handleDestinationChange = (value: string) => {
        form.setData('destination_location_id', value);
    };

    const handleProductChange = (value: string) => {
        form.setData('product_id', value);
    };

    const handleQuantityChange = (event: ChangeEvent<HTMLInputElement>) => {
        form.setData('quantity', event.target.value);
    };

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!form.data.product_id || !form.data.source_location_id || !form.data.destination_location_id) {
            return;
        }

        form.post('/inventory/transfers', {
            preserveScroll: true,
            onSuccess: () => {
                form.setData({
                    ...form.data,
                    product_id: '',
                    quantity: '1',
                });
                setSearchTerm('');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Inventory Transfers" />

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
                                    <ArrowLeftRight className="h-5 w-5" />
                                    <CardTitle>Move inventory</CardTitle>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Transfer product between locations to keep on-hand balances aligned across your operation.
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="source-location">Source location</Label>
                                        <Select value={form.data.source_location_id} onValueChange={handleSourceChange}>
                                            <SelectTrigger id="source-location">
                                                <SelectValue placeholder="Choose a location" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {inventoryLocations.map((location) => (
                                                    <SelectItem key={location.id} value={location.id.toString()}>
                                                        {location.name} ({location.code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={form.errors.source_location_id} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="destination-location">Destination location</Label>
                                        <Select
                                            value={form.data.destination_location_id}
                                            onValueChange={handleDestinationChange}
                                        >
                                            <SelectTrigger id="destination-location">
                                                <SelectValue placeholder="Choose a location" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {inventoryLocations.map((location) => (
                                                    <SelectItem key={location.id} value={location.id.toString()}>
                                                        {location.name} ({location.code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError message={form.errors.destination_location_id} />
                                    </div>
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
                                    <Select value={form.data.product_id} onValueChange={handleProductChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select product" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredProducts.map((product) => (
                                                <SelectItem key={product.id} value={product.id.toString()}>
                                                    {product.name} ({product.barcode})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={form.errors.product_id} />
                                </div>

                                {selectedProduct && (
                                    <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-4 text-sm text-muted-foreground">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <Boxes className="h-4 w-4" />
                                                <span className="font-medium text-foreground">{selectedProduct.name}</span>
                                            </div>
                                            <Badge variant="secondary">Stock: {selectedProduct.stock}</Badge>
                                            <Badge variant="outline">Source on hand: {sourceQuantity}</Badge>
                                            <Badge variant="outline">Destination on hand: {destinationQuantity}</Badge>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="quantity">Quantity</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={form.data.quantity}
                                        onChange={handleQuantityChange}
                                    />
                                    <InputError message={form.errors.quantity} />
                                </div>

                                <Button type="submit" className="w-full" disabled={form.processing}>
                                    Transfer inventory
                                </Button>
                            </CardContent>
                        </Card>
                    </form>

                    <Card className="shadow-sm">
                        <CardHeader className="space-y-2">
                            <div className="flex items-center gap-2">
                                <History className="h-5 w-5" />
                                <CardTitle>Recent transfers</CardTitle>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Review the latest movements between locations for quick reconciliation and audit history.
                            </p>
                        </CardHeader>
                        <CardContent className="overflow-x-auto">
                            <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
                                <thead>
                                    <tr className="border-b text-muted-foreground">
                                        <th className="px-4 py-2 font-medium">Date</th>
                                        <th className="px-4 py-2 font-medium">Product</th>
                                        <th className="px-4 py-2 font-medium">Quantity</th>
                                        <th className="px-4 py-2 font-medium">From</th>
                                        <th className="px-4 py-2 font-medium">To</th>
                                        <th className="px-4 py-2 font-medium">Recorded by</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTransfers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                                                No transfers have been recorded yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        recentTransfers.map((transfer) => (
                                            <tr key={transfer.id} className="border-b last:border-0">
                                                <td className="px-4 py-3 align-top">{formatDate(transfer.created_at)}</td>
                                                <td className="px-4 py-3 align-top">
                                                    <div className="font-medium text-foreground">{transfer.product.name}</div>
                                                    <div className="text-xs text-muted-foreground">{transfer.product.barcode}</div>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <Badge variant="secondary">{transfer.quantity}</Badge>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <div className="font-medium text-foreground">{transfer.source.name}</div>
                                                    <div className="text-xs text-muted-foreground">{transfer.source.code}</div>
                                                </td>
                                                <td className="px-4 py-3 align-top">
                                                    <div className="font-medium text-foreground">{transfer.destination.name}</div>
                                                    <div className="text-xs text-muted-foreground">{transfer.destination.code}</div>
                                                </td>
                                                <td className="px-4 py-3 align-top">{transfer.user.name}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
