import { TablePagination, TableToolbar } from '@/components/table-controls';
import InputError from '@/components/input-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useTableControls } from '@/hooks/use-table-controls';
import {
    AlertTriangle,
    Download,
    Edit,
    Image as ImageIcon,
    PlusCircle,
    Trash2,
    Upload,
} from 'lucide-react';

interface CategorySummary {
    id: number;
    name: string;
}

interface SupplierSummary {
    id: number;
    name: string;
    lead_time_days: number;
}

interface ProductSummary {
    id: number;
    barcode: string;
    name: string;
    supplier: SupplierSummary | null;
    supplier_id: number | null;
    supplier_sku: string | null;
    stock: number;
    price: string | number;
    cost_price: string | number | null;
    image_path: string | null;
    image_url: string | null;
    reorder_point: number | null;
    reorder_quantity: number | null;
    effective_reorder_point: number;
    is_low_stock: boolean;
    created_at?: string | null;
    updated_at?: string | null;
    categories: CategorySummary[];
}

interface ProductsPageProps {
    products: ProductSummary[];
    availableCategories: CategorySummary[];
    defaultReorderPoint: number;
    availableSuppliers: SupplierSummary[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: '/master/products',
    },
];

const NO_SUPPLIER_VALUE = 'none';

const formatPrice = (price: string | number): string => {
    const numeric = typeof price === 'string' ? Number.parseFloat(price) : price;

    if (Number.isNaN(numeric)) {
        return '0.00';
    }

    return numeric.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const extractCategoryError = (
    errors: Record<string, string | undefined>,
): string | undefined => {
    if (errors.category_ids) {
        return errors.category_ids;
    }

    const nestedError = Object.entries(errors).find(([key]) =>
        key.startsWith('category_ids.'),
    );

    return nestedError?.[1];
};

const updateCategorySelection = (
    selectedIds: number[],
    categoryId: number,
    shouldSelect: boolean,
): number[] => {
    if (shouldSelect) {
        return Array.from(new Set([...selectedIds, categoryId]));
    }

    return selectedIds.filter((id) => id !== categoryId);
};

export default function ProductsIndex({
    products,
    availableCategories,
    defaultReorderPoint,
    availableSuppliers,
}: ProductsPageProps) {
    const { flash } = usePage<SharedData>().props;
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [productBeingEdited, setProductBeingEdited] =
        useState<ProductSummary | null>(null);

    const createForm = useForm<{
        supplier_id: string;
        barcode: string;
        name: string;
        supplier_sku: string;
        stock: string;
        price: string;
        cost_price: string;
        reorder_point: string;
        reorder_quantity: string;
        image: File | null;
        category_ids: number[];
    }>({
        supplier_id: '',
        barcode: '',
        name: '',
        supplier_sku: '',
        stock: '0',
        price: '0.00',
        cost_price: '',
        reorder_point: '',
        reorder_quantity: '',
        image: null,
        category_ids: [],
    });

    const editForm = useForm<{
        supplier_id: string;
        barcode: string;
        name: string;
        supplier_sku: string;
        stock: string;
        price: string;
        cost_price: string;
        reorder_point: string;
        reorder_quantity: string;
        image: File | null;
        remove_image: boolean;
        category_ids: number[];
    }>({
        supplier_id: '',
        barcode: '',
        name: '',
        supplier_sku: '',
        stock: '0',
        price: '0.00',
        cost_price: '',
        reorder_point: '',
        reorder_quantity: '',
        image: null,
        remove_image: false,
        category_ids: [],
    });

    const importForm = useForm<{
        file: File | null;
    }>({
        file: null,
    });

    const deleteForm = useForm({});

    const handleEditDialogChange = (product: ProductSummary) => (open: boolean) => {
        setIsEditOpen(open);

        if (open) {
            setProductBeingEdited(product);
            editForm.setData((data) => ({
                ...data,
                supplier_id:
                    product.supplier_id !== null
                        ? product.supplier_id.toString()
                        : '',
                barcode: product.barcode,
                name: product.name,
                supplier_sku: product.supplier_sku ?? '',
                stock: product.stock.toString(),
                price: product.price.toString(),
                cost_price:
                    product.cost_price !== null
                        ? product.cost_price.toString()
                        : '',
                reorder_point:
                    product.reorder_point !== null
                        ? product.reorder_point.toString()
                        : '',
                reorder_quantity:
                    product.reorder_quantity !== null
                        ? product.reorder_quantity.toString()
                        : '',
                image: null,
                remove_image: false,
                category_ids: product.categories.map((category) => category.id),
            }));
            editForm.clearErrors();
            return;
        }

        editForm.reset();
        editForm.clearErrors();
        setProductBeingEdited(null);
    };

    const productControls = useTableControls(products, {
        searchFields: [
            (product) => product.name,
            (product) => product.barcode,
            (product) => product.supplier?.name ?? '',
        ],
        filters: [
            { label: 'Semua produk', value: 'all' },
            {
                label: 'Stok rendah',
                value: 'low-stock',
                predicate: (product) => product.is_low_stock,
            },
            {
                label: 'Tanpa pemasok',
                value: 'without-supplier',
                predicate: (product) => product.supplier == null,
            },
        ],
        initialPageSize: 10,
    });

    const totalProducts = useMemo(() => products.length, [products.length]);

    const createCategoryError = extractCategoryError(
        createForm.errors as Record<string, string | undefined>,
    );
    const editCategoryError = extractCategoryError(
        editForm.errors as Record<string, string | undefined>,
    );

    const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        createForm.post('/master/products', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                createForm.reset();
                createForm.setData('stock', '0');
                createForm.setData('price', '0.00');
                createForm.setData('reorder_point', '');
                createForm.setData('reorder_quantity', '');
            },
        });
    };

    const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!productBeingEdited) {
            return;
        }

        editForm.put(`/master/products/${productBeingEdited.id}`, {
            method: 'put',
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                setIsEditOpen(false);
            },
        });
    };

    const handleDelete = (product: ProductSummary) => {
        if (
            window.confirm(
                `Delete ${product.name}? This action cannot be undone.`,
            )
        ) {
            deleteForm.delete(`/master/products/${product.id}`, {
                preserveScroll: true,
            });
        }
    };

    const handleImportSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        importForm.post('/master/products/import', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => importForm.reset(),
        });
    };

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        createForm.setData('image', event.target.files?.[0] ?? null);
    };

    const handleEditFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        editForm.setData('image', event.target.files?.[0] ?? null);
    };

    const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        importForm.setData('file', event.target.files?.[0] ?? null);
    };

    const handleCreateCategoryToggle = (categoryId: number) => (
        checked: boolean | 'indeterminate',
    ) => {
        createForm.setData((data) => ({
            ...data,
            category_ids: updateCategorySelection(
                data.category_ids,
                categoryId,
                checked === true,
            ),
        }));
    };

    const handleEditCategoryToggle = (categoryId: number) => (
        checked: boolean | 'indeterminate',
    ) => {
        editForm.setData((data) => ({
            ...data,
            category_ids: updateCategorySelection(
                data.category_ids,
                categoryId,
                checked === true,
            ),
        }));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Products" />

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

                <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                    <div className="space-y-6">
                        <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                            <header className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <PlusCircle className="h-5 w-5" />
                                    <h2 className="text-lg font-semibold">Create product</h2>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Add a new item to your catalogue with barcode, stock level, price, optional image and categories.
                                </p>
                            </header>

                            <form onSubmit={handleCreateSubmit} className="space-y-4" encType="multipart/form-data">
                                <div className="space-y-2">
                                    <Label htmlFor="product-barcode">Barcode</Label>
                                    <Input
                                        id="product-barcode"
                                        name="barcode"
                                        placeholder="e.g. 1234567890123"
                                        value={createForm.data.barcode}
                                        onChange={(event) =>
                                            createForm.setData('barcode', event.target.value)
                                        }
                                        autoComplete="off"
                                    />
                                    <InputError message={createForm.errors.barcode} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="product-name">Name</Label>
                                    <Input
                                        id="product-name"
                                        name="name"
                                        placeholder="e.g. Wireless Mouse"
                                        value={createForm.data.name}
                                        onChange={(event) =>
                                            createForm.setData('name', event.target.value)
                                        }
                                        autoComplete="off"
                                    />
                                    <InputError message={createForm.errors.name} />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="product-stock">Stock</Label>
                                        <Input
                                            id="product-stock"
                                            name="stock"
                                            type="number"
                                            min={0}
                                            value={createForm.data.stock}
                                            onChange={(event) =>
                                                createForm.setData('stock', event.target.value)
                                            }
                                        />
                                        <InputError message={createForm.errors.stock} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="product-price">Price</Label>
                                        <Input
                                            id="product-price"
                                            name="price"
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={createForm.data.price}
                                            onChange={(event) =>
                                                createForm.setData('price', event.target.value)
                                            }
                                        />
                                        <InputError message={createForm.errors.price} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="product-cost-price">Cost price</Label>
                                        <Input
                                            id="product-cost-price"
                                            name="cost_price"
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={createForm.data.cost_price}
                                            onChange={(event) =>
                                                createForm.setData(
                                                    'cost_price',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError message={createForm.errors.cost_price} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="product-supplier">Supplier</Label>
                                    <Select
                                        value={
                                            createForm.data.supplier_id === ''
                                                ? NO_SUPPLIER_VALUE
                                                : createForm.data.supplier_id
                                        }
                                        onValueChange={(value) =>
                                            createForm.setData(
                                                'supplier_id',
                                                value === NO_SUPPLIER_VALUE
                                                    ? ''
                                                    : value,
                                            )
                                        }
                                    >
                                        <SelectTrigger id="product-supplier">
                                            <SelectValue placeholder="Select a supplier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NO_SUPPLIER_VALUE}>
                                                No supplier
                                            </SelectItem>
                                            {availableSuppliers.map((supplier) => (
                                                <SelectItem
                                                    key={supplier.id}
                                                    value={supplier.id.toString()}
                                                >
                                                    {supplier.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <InputError message={createForm.errors.supplier_id} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="product-supplier-sku">Supplier SKU</Label>
                                    <Input
                                        id="product-supplier-sku"
                                        name="supplier_sku"
                                        placeholder="Reference used by the supplier"
                                        value={createForm.data.supplier_sku}
                                        onChange={(event) =>
                                            createForm.setData(
                                                'supplier_sku',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={createForm.errors.supplier_sku} />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="product-reorder-point">Reorder point</Label>
                                        <Input
                                            id="product-reorder-point"
                                            name="reorder_point"
                                            type="number"
                                            min={0}
                                            value={createForm.data.reorder_point}
                                            placeholder={`Default: ${defaultReorderPoint.toLocaleString()}`}
                                            onChange={(event) =>
                                                createForm.setData(
                                                    'reorder_point',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Leave blank to inherit the store default threshold.
                                        </p>
                                        <InputError message={createForm.errors.reorder_point} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="product-reorder-quantity">Reorder quantity</Label>
                                        <Input
                                            id="product-reorder-quantity"
                                            name="reorder_quantity"
                                            type="number"
                                            min={0}
                                            value={createForm.data.reorder_quantity}
                                            placeholder="e.g. 25"
                                            onChange={(event) =>
                                                createForm.setData(
                                                    'reorder_quantity',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Suggest how many units to purchase when restocking.
                                        </p>
                                        <InputError message={createForm.errors.reorder_quantity} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Categories</Label>
                                    {availableCategories.length > 0 ? (
                                        <div className="grid gap-2">
                                            {availableCategories.map((category) => (
                                                <label
                                                    key={category.id}
                                                    htmlFor={`create-category-${category.id}`}
                                                    className="flex items-center gap-2 text-sm"
                                                >
                                                    <Checkbox
                                                        id={`create-category-${category.id}`}
                                                        checked={createForm.data.category_ids.includes(
                                                            category.id,
                                                        )}
                                                        onCheckedChange={handleCreateCategoryToggle(category.id)}
                                                    />
                                                    <span>{category.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            No categories yet. Use the import tool or export file to manage categories in bulk.
                                        </p>
                                    )}
                                    <InputError message={createCategoryError} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="product-image">Image</Label>
                                    <Input
                                        id="product-image"
                                        name="image"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                    <InputError message={createForm.errors.image} />
                                </div>

                                <Button type="submit" disabled={createForm.processing} className="w-full">
                                    Create product
                                </Button>
                            </form>
                        </section>

                        <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                            <header className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Upload className="h-5 w-5" />
                                    <h2 className="text-lg font-semibold">Import / Export</h2>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Use spreadsheet files with headers <Badge variant="secondary">barcode</Badge>, <Badge variant="secondary">name</Badge>, <Badge variant="secondary">stock</Badge>, <Badge variant="secondary">price</Badge>, optional <Badge variant="secondary">reorder_point</Badge>, optional <Badge variant="secondary">reorder_quantity</Badge>, optional <Badge variant="secondary">image_path</Badge> and optional <Badge variant="secondary">categories</Badge> (comma, semicolon or pipe separated) to bulk manage products.
                                </p>
                            </header>

                            <form onSubmit={handleImportSubmit} className="space-y-3" encType="multipart/form-data">
                                <div className="space-y-2">
                                    <Label htmlFor="import-file">Import file</Label>
                                    <Input
                                        id="import-file"
                                        name="file"
                                        type="file"
                                        accept=".csv,.xls,.xlsx,.txt"
                                        onChange={handleImportFileChange}
                                    />
                                    <InputError message={importForm.errors.file} />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={importForm.processing || !importForm.data.file}
                                    className="w-full"
                                >
                                    <Upload className="mr-2 h-4 w-4" /> Import products
                                </Button>
                            </form>

                            <div className="space-y-2">
                                <Label>Export</Label>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <a href="/master/products/export?format=xlsx">
                                            <Download className="mr-2 h-4 w-4" /> Excel (.xlsx)
                                        </a>
                                    </Button>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href="/master/products/export?format=csv">
                                            <Download className="mr-2 h-4 w-4" /> CSV
                                        </a>
                                    </Button>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href="/master/products/export?format=xls">
                                            <Download className="mr-2 h-4 w-4" /> Excel 97-2003 (.xls)
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Product catalogue</h2>
                                <p className="text-sm text-muted-foreground">
                                    Manage the {totalProducts} products currently tracked in your store.
                                </p>
                            </div>
                        </header>

                        <TableToolbar
                            searchTerm={productControls.searchTerm}
                            onSearchChange={productControls.setSearchTerm}
                            searchPlaceholder="Cari nama produk atau barcode"
                            filterOptions={productControls.filterOptions}
                            filterValue={productControls.filterValue}
                            onFilterChange={productControls.setFilterValue}
                            pageSize={productControls.pageSize}
                            pageSizeOptions={productControls.pageSizeOptions}
                            onPageSizeChange={productControls.setPageSize}
                            total={productControls.total}
                            filteredTotal={productControls.filteredTotal}
                        />

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[700px] text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">Barcode</th>
                                        <th className="px-3 py-2">Name</th>
                                        <th className="px-3 py-2">Supplier</th>
                                        <th className="px-3 py-2 text-right">Stock</th>
                                        <th className="px-3 py-2 text-right">Reorder</th>
                                        <th className="px-3 py-2 text-right">Price</th>
                                        <th className="px-3 py-2">Categories</th>
                                        <th className="px-3 py-2">Image</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productControls.total === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="px-3 py-6 text-center text-sm text-muted-foreground"
                                            >
                                                No products yet. Use the form on the left to add your first item or import from a spreadsheet.
                                            </td>
                                        </tr>
                                    ) : productControls.filteredTotal === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={9}
                                                className="px-3 py-6 text-center text-sm text-muted-foreground"
                                            >
                                                Tidak ada produk yang cocok dengan pencarian atau filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        productControls.items.map((product) => (
                                            <tr
                                                key={product.id}
                                                className={`border-b border-muted/50 last:border-b-0 ${
                                                    product.is_low_stock ? 'bg-destructive/5' : ''
                                                }`}
                                            >
                                                <td className="px-3 py-3 font-medium">{product.barcode}</td>
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {product.is_low_stock && (
                                                            <span
                                                                className="inline-flex items-center text-destructive"
                                                                title="Low stock"
                                                            >
                                                                <AlertTriangle
                                                                    className="h-4 w-4"
                                                                    aria-hidden="true"
                                                                />
                                                            </span>
                                                        )}
                                                        <span>{product.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {product.supplier ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-medium">
                                                                {product.supplier.name}
                                                            </span>
                                                            {product.supplier.lead_time_days > 0 && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Lead time: {product.supplier.lead_time_days} day
                                                                    {product.supplier.lead_time_days === 1 ? '' : 's'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline">Unassigned</Badge>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span
                                                            className={`font-medium ${
                                                                product.is_low_stock
                                                                    ? 'text-destructive'
                                                                    : ''
                                                            }`}
                                                        >
                                                            {product.stock.toLocaleString()}
                                                        </span>
                                                        {product.is_low_stock && (
                                                            <Badge
                                                                variant="destructive"
                                                                className="text-[0.65rem] uppercase tracking-wide"
                                                            >
                                                                Restock
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <span className="font-medium">
                                                            {product.effective_reorder_point.toLocaleString()}
                                                        </span>
                                                        <div className="flex flex-wrap justify-end gap-1 text-xs text-muted-foreground">
                                                            <Badge variant="outline">
                                                                {product.reorder_point === null
                                                                    ? 'Default threshold'
                                                                    : 'Custom threshold'}
                                                            </Badge>
                                                            <span>
                                                                Qty:{' '}
                                                                <span className="font-medium text-foreground">
                                                                    {product.reorder_quantity !== null
                                                                        ? product.reorder_quantity.toLocaleString()
                                                                        : '—'}
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right">{formatPrice(product.price)}</td>
                                                <td className="px-3 py-3">
                                                    {product.categories.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {product.categories.map((category) => (
                                                                <Badge key={category.id} variant="secondary">
                                                                    {category.name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <Badge variant="outline">Uncategorised</Badge>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {product.image_url ? (
                                                        <div className="flex items-center gap-2">
                                                            <img
                                                                src={product.image_url}
                                                                alt={product.name}
                                                                className="h-10 w-10 rounded-md object-cover"
                                                            />
                                                            <Badge variant="outline">Uploaded</Badge>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <ImageIcon className="h-4 w-4" />
                                                            <span>No image</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Dialog
                                                            open={
                                                                isEditOpen &&
                                                                productBeingEdited?.id === product.id
                                                            }
                                                            onOpenChange={handleEditDialogChange(product)}
                                                        >
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    aria-label={`Edit ${product.name}`}
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="sm:max-w-lg">
                                                                <DialogHeader>
                                                                    <DialogTitle>Edit product</DialogTitle>
                                                                    <DialogDescription>
                                                                        Update the core information for{' '}
                                                                        {productBeingEdited?.name ?? product.name}.
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <form
                                                                    onSubmit={handleEditSubmit}
                                                                    className="space-y-4"
                                                                    encType="multipart/form-data"
                                                                >
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-barcode">Barcode</Label>
                                                                        <Input
                                                                            id="edit-barcode"
                                                                            name="barcode"
                                                                            value={editForm.data.barcode}
                                                                            onChange={(event) =>
                                                                                editForm.setData(
                                                                                    'barcode',
                                                                                    event.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError message={editForm.errors.barcode} />
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-name">Name</Label>
                                                                        <Input
                                                                            id="edit-name"
                                                                            name="name"
                                                                            value={editForm.data.name}
                                                                            onChange={(event) =>
                                                                                editForm.setData(
                                                                                    'name',
                                                                                    event.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError message={editForm.errors.name} />
                                                                    </div>

                                                                    <div className="grid gap-4 sm:grid-cols-3">
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="edit-stock">Stock</Label>
                                                                            <Input
                                                                                id="edit-stock"
                                                                                name="stock"
                                                                                type="number"
                                                                                min={0}
                                                                                value={editForm.data.stock}
                                                                                onChange={(event) =>
                                                                                    editForm.setData(
                                                                                        'stock',
                                                                                        event.target.value,
                                                                                    )
                                                                                }
                                                                            />
                                                                            <InputError message={editForm.errors.stock} />
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="edit-price">Price</Label>
                                                                            <Input
                                                                                id="edit-price"
                                                                                name="price"
                                                                                type="number"
                                                                                min={0}
                                                                                step="0.01"
                                                                                value={editForm.data.price}
                                                                                onChange={(event) =>
                                                                                    editForm.setData(
                                                                                        'price',
                                                                                        event.target.value,
                                                                                    )
                                                                                }
                                                                            />
                                                                            <InputError message={editForm.errors.price} />
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="edit-cost-price">Cost price</Label>
                                                                            <Input
                                                                                id="edit-cost-price"
                                                                                name="cost_price"
                                                                                type="number"
                                                                                min={0}
                                                                                step="0.01"
                                                                                value={editForm.data.cost_price}
                                                                                onChange={(event) =>
                                                                                    editForm.setData(
                                                                                        'cost_price',
                                                                                        event.target.value,
                                                                                    )
                                                                                }
                                                                            />
                                                                            <InputError message={editForm.errors.cost_price} />
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-supplier">Supplier</Label>
                                                                        <Select
                                                                            value={
                                                                                editForm.data
                                                                                    .supplier_id === ''
                                                                                    ? NO_SUPPLIER_VALUE
                                                                                    : editForm.data
                                                                                          .supplier_id
                                                                            }
                                                                            onValueChange={(value) =>
                                                                                editForm.setData(
                                                                                    'supplier_id',
                                                                                    value ===
                                                                                        NO_SUPPLIER_VALUE
                                                                                        ? ''
                                                                                        : value,
                                                                                )
                                                                            }
                                                                        >
                                                                            <SelectTrigger id="edit-supplier">
                                                                                <SelectValue placeholder="Select a supplier" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem
                                                                                    value={
                                                                                        NO_SUPPLIER_VALUE
                                                                                    }
                                                                                >
                                                                                    No supplier
                                                                                </SelectItem>
                                                                                {availableSuppliers.map((supplier) => (
                                                                                    <SelectItem
                                                                                        key={supplier.id}
                                                                                        value={supplier.id.toString()}
                                                                                    >
                                                                                        {supplier.name}
                                                                                    </SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                        <InputError message={editForm.errors.supplier_id} />
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-supplier-sku">Supplier SKU</Label>
                                                                        <Input
                                                                            id="edit-supplier-sku"
                                                                            name="supplier_sku"
                                                                            value={editForm.data.supplier_sku}
                                                                            onChange={(event) =>
                                                                                editForm.setData(
                                                                                    'supplier_sku',
                                                                                    event.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError message={editForm.errors.supplier_sku} />
                                                                    </div>

                                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="edit-reorder-point">Reorder point</Label>
                                                                            <Input
                                                                                id="edit-reorder-point"
                                                                                name="reorder_point"
                                                                                type="number"
                                                                                min={0}
                                                                                value={editForm.data.reorder_point}
                                                                                placeholder={`Default: ${defaultReorderPoint.toLocaleString()}`}
                                                                                onChange={(event) =>
                                                                                    editForm.setData(
                                                                                        'reorder_point',
                                                                                        event.target.value,
                                                                                    )
                                                                                }
                                                                            />
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Leave blank to use the store default threshold.
                                                                            </p>
                                                                            <InputError message={editForm.errors.reorder_point} />
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="edit-reorder-quantity">Reorder quantity</Label>
                                                                            <Input
                                                                                id="edit-reorder-quantity"
                                                                                name="reorder_quantity"
                                                                                type="number"
                                                                                min={0}
                                                                                value={editForm.data.reorder_quantity}
                                                                                placeholder="e.g. 25"
                                                                                onChange={(event) =>
                                                                                    editForm.setData(
                                                                                        'reorder_quantity',
                                                                                        event.target.value,
                                                                                    )
                                                                                }
                                                                            />
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Suggest how many units to order when replenishing.
                                                                            </p>
                                                                            <InputError message={editForm.errors.reorder_quantity} />
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label>Categories</Label>
                                                                        {availableCategories.length > 0 ? (
                                                                            <div className="grid gap-2">
                                                                                {availableCategories.map((category) => (
                                                                                    <label
                                                                                        key={category.id}
                                                                                        htmlFor={`edit-category-${category.id}`}
                                                                                        className="flex items-center gap-2 text-sm"
                                                                                    >
                                                                                        <Checkbox
                                                                                            id={`edit-category-${category.id}`}
                                                                                            checked={editForm.data.category_ids.includes(
                                                                                                category.id,
                                                                                            )}
                                                                                            onCheckedChange={handleEditCategoryToggle(
                                                                                                category.id,
                                                                                            )}
                                                                                        />
                                                                                        <span>{category.name}</span>
                                                                                    </label>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-sm text-muted-foreground">
                                                                                No categories available yet. Import a spreadsheet to create them automatically.
                                                                            </p>
                                                                        )}
                                                                        <InputError message={editCategoryError} />
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-image">Replace image</Label>
                                                                        <Input
                                                                            id="edit-image"
                                                                            name="image"
                                                                            type="file"
                                                                            accept="image/*"
                                                                            onChange={handleEditFileChange}
                                                                        />
                                                                        <InputError message={editForm.errors.image} />
                                                                    </div>

                                                                    {productBeingEdited?.image_url && (
                                                                        <div className="flex items-center justify-between rounded-lg border border-dashed border-muted-foreground/40 p-3">
                                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                                <img
                                                                                    src={productBeingEdited.image_url}
                                                                                    alt={productBeingEdited.name}
                                                                                    className="h-12 w-12 rounded-md object-cover"
                                                                                />
                                                                                <span>Current image</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <Checkbox
                                                                                    id="remove-image"
                                                                                    checked={editForm.data.remove_image}
                                                                                    onCheckedChange={(value) =>
                                                                                        editForm.setData(
                                                                                            'remove_image',
                                                                                            value === true,
                                                                                        )
                                                                                    }
                                                                                />
                                                                                <Label
                                                                                    htmlFor="remove-image"
                                                                                    className="text-sm"
                                                                                >
                                                                                    Remove image
                                                                                </Label>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    <DialogFooter>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            onClick={() => setIsEditOpen(false)}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            type="submit"
                                                                            disabled={editForm.processing}
                                                                        >
                                                                            Save changes
                                                                        </Button>
                                                                    </DialogFooter>
                                                                </form>
                                                            </DialogContent>
                                                        </Dialog>

                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => handleDelete(product)}
                                                            aria-label={`Delete ${product.name}`}
                                                            disabled={deleteForm.processing}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <TablePagination
                            page={productControls.page}
                            pageCount={productControls.pageCount}
                            onPageChange={productControls.goToPage}
                            range={productControls.range}
                            total={productControls.total}
                            filteredTotal={productControls.filteredTotal}
                        />
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}
