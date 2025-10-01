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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { Building2, Edit, PlusCircle, Trash2 } from 'lucide-react';

interface SupplierSummary {
    id: number;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    lead_time_days: number;
    notes: string | null;
    product_count: number;
    created_at?: string | null;
    updated_at?: string | null;
}

interface ProductReference {
    id: number;
    name: string;
    barcode: string;
}

interface SuppliersPageProps {
    suppliers: SupplierSummary[];
    unassignedProducts: ProductReference[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Suppliers',
        href: '/inventory/suppliers',
    },
];

export default function SuppliersIndex({
    suppliers,
    unassignedProducts,
}: SuppliersPageProps) {
    const { flash } = usePage<SharedData>().props;
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [supplierBeingEdited, setSupplierBeingEdited] =
        useState<SupplierSummary | null>(null);

    const createForm = useForm<{
        name: string;
        contact_name: string;
        email: string;
        phone: string;
        lead_time_days: string;
        notes: string;
    }>({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        lead_time_days: '',
        notes: '',
    });

    const editForm = useForm<{
        name: string;
        contact_name: string;
        email: string;
        phone: string;
        lead_time_days: string;
        notes: string;
    }>({
        name: '',
        contact_name: '',
        email: '',
        phone: '',
        lead_time_days: '',
        notes: '',
    });

    const deleteForm = useForm({});

    const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        createForm.post('/inventory/suppliers', {
            onSuccess: () => createForm.reset(),
        });
    };

    const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!supplierBeingEdited) {
            return;
        }

        editForm.put(`/inventory/suppliers/${supplierBeingEdited.id}`, {
            onSuccess: () => {
                setIsEditOpen(false);
                editForm.clearErrors();
            },
        });
    };

    const handleDelete = (supplier: SupplierSummary) => {
        if (!window.confirm(`Delete supplier ${supplier.name}?`)) {
            return;
        }

        deleteForm.delete(`/inventory/suppliers/${supplier.id}`);
    };

    const handleEditDialogChange = (supplier: SupplierSummary) => (open: boolean) => {
        setIsEditOpen(open);

        if (open) {
            setSupplierBeingEdited(supplier);
            editForm.setData({
                name: supplier.name,
                contact_name: supplier.contact_name ?? '',
                email: supplier.email ?? '',
                phone: supplier.phone ?? '',
                lead_time_days:
                    supplier.lead_time_days > 0
                        ? supplier.lead_time_days.toString()
                        : '',
                notes: supplier.notes ?? '',
            });
            editForm.clearErrors();
            return;
        }

        setSupplierBeingEdited(null);
        editForm.reset();
        editForm.clearErrors();
    };

    const unassignedCount = useMemo(
        () => unassignedProducts.length,
        [unassignedProducts.length],
    );

    const handleCreateNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        createForm.setData('notes', event.target.value);
    };

    const handleEditNotesChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        editForm.setData('notes', event.target.value);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Suppliers" />

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
                                    <h2 className="text-lg font-semibold">Register supplier</h2>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Capture supplier contact information, lead times and notes to power automated reordering.
                                </p>
                            </header>

                            <form onSubmit={handleCreateSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="create-name">Name</Label>
                                    <Input
                                        id="create-name"
                                        name="name"
                                        value={createForm.data.name}
                                        onChange={(event) =>
                                            createForm.setData('name', event.target.value)
                                        }
                                    />
                                    <InputError message={createForm.errors.name} />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="create-contact-name">Contact person</Label>
                                        <Input
                                            id="create-contact-name"
                                            name="contact_name"
                                            value={createForm.data.contact_name}
                                            onChange={(event) =>
                                                createForm.setData(
                                                    'contact_name',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError message={createForm.errors.contact_name} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="create-phone">Phone</Label>
                                        <Input
                                            id="create-phone"
                                            name="phone"
                                            value={createForm.data.phone}
                                            onChange={(event) =>
                                                createForm.setData('phone', event.target.value)
                                            }
                                        />
                                        <InputError message={createForm.errors.phone} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="create-email">Email</Label>
                                    <Input
                                        id="create-email"
                                        name="email"
                                        type="email"
                                        value={createForm.data.email}
                                        onChange={(event) =>
                                            createForm.setData('email', event.target.value)
                                        }
                                    />
                                    <InputError message={createForm.errors.email} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="create-lead-time">Lead time (days)</Label>
                                    <Input
                                        id="create-lead-time"
                                        name="lead_time_days"
                                        type="number"
                                        min={0}
                                        value={createForm.data.lead_time_days}
                                        onChange={(event) =>
                                            createForm.setData(
                                                'lead_time_days',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={createForm.errors.lead_time_days} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="create-notes">Notes</Label>
                                    <textarea
                                        id="create-notes"
                                        name="notes"
                                        value={createForm.data.notes}
                                        onChange={handleCreateNotesChange}
                                        className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                    <InputError message={createForm.errors.notes} />
                                </div>

                                <Button type="submit" disabled={createForm.processing} className="w-full">
                                    Create supplier
                                </Button>
                            </form>
                        </section>

                        <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                            <header className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-5 w-5" />
                                    <h2 className="text-lg font-semibold">Unassigned products</h2>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {unassignedCount > 0
                                        ? 'Link these products to suppliers so automated purchase orders know where to route.'
                                        : 'All products have been assigned to suppliers.'}
                                </p>
                            </header>

                            {unassignedCount === 0 ? (
                                <p className="text-sm text-muted-foreground">Great! Every product has a supplier.</p>
                            ) : (
                                <div className="space-y-3">
                                    {unassignedProducts.slice(0, 10).map((product) => (
                                        <div
                                            key={product.id}
                                            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{product.name}</span>
                                                <span className="text-xs text-muted-foreground">Barcode: {product.barcode}</span>
                                            </div>
                                            <Badge variant="outline">Unassigned</Badge>
                                        </div>
                                    ))}

                                    {unassignedCount > 10 && (
                                        <p className="text-xs text-muted-foreground">
                                            And {unassignedCount - 10} more product{unassignedCount - 10 === 1 ? '' : 's'}.
                                        </p>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>

                    <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Supplier directory</h2>
                                <p className="text-sm text-muted-foreground">
                                    Manage {suppliers.length} suppliers across your network.
                                </p>
                            </div>
                        </header>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">Name</th>
                                        <th className="px-3 py-2">Contact</th>
                                        <th className="px-3 py-2">Email</th>
                                        <th className="px-3 py-2">Phone</th>
                                        <th className="px-3 py-2 text-right">Lead time</th>
                                        <th className="px-3 py-2 text-right">Products</th>
                                        <th className="px-3 py-2">Notes</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                className="px-3 py-6 text-center text-sm text-muted-foreground"
                                            >
                                                No suppliers yet. Use the form on the left to add your first partner.
                                            </td>
                                        </tr>
                                    ) : (
                                        suppliers.map((supplier) => (
                                            <tr key={supplier.id} className="border-b border-muted/50 last:border-b-0">
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-medium">{supplier.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Updated {supplier.updated_at ? new Date(supplier.updated_at).toLocaleDateString() : 'recently'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3">
                                                    {supplier.contact_name ? (
                                                        <span>{supplier.contact_name}</span>
                                                    ) : (
                                                        <Badge variant="outline">Not provided</Badge>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {supplier.email ? (
                                                        <a
                                                            href={`mailto:${supplier.email}`}
                                                            className="text-blue-600 hover:underline dark:text-blue-300"
                                                        >
                                                            {supplier.email}
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {supplier.phone ?? <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    {supplier.lead_time_days > 0 ? (
                                                        <span>{supplier.lead_time_days} day{supplier.lead_time_days === 1 ? '' : 's'}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">Same day</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    {supplier.product_count}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {supplier.notes ? (
                                                        <p className="line-clamp-2 text-sm text-muted-foreground">
                                                            {supplier.notes}
                                                        </p>
                                                    ) : (
                                                        <span className="text-muted-foreground">No notes</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Dialog
                                                            open={
                                                                isEditOpen &&
                                                                supplierBeingEdited?.id === supplier.id
                                                            }
                                                            onOpenChange={handleEditDialogChange(supplier)}
                                                        >
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    aria-label={`Edit ${supplier.name}`}
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="sm:max-w-lg">
                                                                <DialogHeader>
                                                                    <DialogTitle>Edit supplier</DialogTitle>
                                                                    <DialogDescription>
                                                                        Update key information for {supplier.name}.
                                                                    </DialogDescription>
                                                                </DialogHeader>
                                                                <form onSubmit={handleEditSubmit} className="space-y-4">
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

                                                                    <div className="grid gap-4 sm:grid-cols-2">
                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="edit-contact-name">Contact person</Label>
                                                                            <Input
                                                                                id="edit-contact-name"
                                                                                name="contact_name"
                                                                                value={editForm.data.contact_name}
                                                                                onChange={(event) =>
                                                                                    editForm.setData(
                                                                                        'contact_name',
                                                                                        event.target.value,
                                                                                    )
                                                                                }
                                                                            />
                                                                            <InputError message={editForm.errors.contact_name} />
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                            <Label htmlFor="edit-phone">Phone</Label>
                                                                            <Input
                                                                                id="edit-phone"
                                                                                name="phone"
                                                                                value={editForm.data.phone}
                                                                                onChange={(event) =>
                                                                                    editForm.setData(
                                                                                        'phone',
                                                                                        event.target.value,
                                                                                    )
                                                                                }
                                                                            />
                                                                            <InputError message={editForm.errors.phone} />
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-email">Email</Label>
                                                                        <Input
                                                                            id="edit-email"
                                                                            name="email"
                                                                            type="email"
                                                                            value={editForm.data.email}
                                                                            onChange={(event) =>
                                                                                editForm.setData(
                                                                                    'email',
                                                                                    event.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError message={editForm.errors.email} />
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-lead-time">Lead time (days)</Label>
                                                                        <Input
                                                                            id="edit-lead-time"
                                                                            name="lead_time_days"
                                                                            type="number"
                                                                            min={0}
                                                                            value={editForm.data.lead_time_days}
                                                                            onChange={(event) =>
                                                                                editForm.setData(
                                                                                    'lead_time_days',
                                                                                    event.target.value,
                                                                                )
                                                                            }
                                                                        />
                                                                        <InputError message={editForm.errors.lead_time_days} />
                                                                    </div>

                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-notes">Notes</Label>
                                                                        <textarea
                                                                            id="edit-notes"
                                                                            name="notes"
                                                                            value={editForm.data.notes}
                                                                            onChange={handleEditNotesChange}
                                                                            className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                                        />
                                                                        <InputError message={editForm.errors.notes} />
                                                                    </div>

                                                                    <DialogFooter>
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            onClick={() => setIsEditOpen(false)}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button type="submit" disabled={editForm.processing}>
                                                                            Save changes
                                                                        </Button>
                                                                    </DialogFooter>
                                                                </form>
                                                            </DialogContent>
                                                        </Dialog>

                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            aria-label={`Delete ${supplier.name}`}
                                                            onClick={() => handleDelete(supplier)}
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
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}
