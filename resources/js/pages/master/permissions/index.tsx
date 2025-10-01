import InputError from '@/components/input-error';
import { TablePagination, TableToolbar } from '@/components/table-controls';
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
import AppLayout from '@/layouts/app-layout';
import { useTableControls } from '@/hooks/use-table-controls';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { type FormEvent, useEffect, useState } from 'react';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';

interface PermissionSummary {
    id: number;
    name: string;
    roles_count: number;
    is_protected: boolean;
}

interface PermissionsPageProps {
    permissions: PermissionSummary[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Permissions',
        href: '/master/permissions',
    },
];

export default function PermissionsIndex({ permissions }: PermissionsPageProps) {
    const { flash } = usePage<SharedData>().props;
    const createForm = useForm({
        name: '',
    });
    const editForm = useForm({
        name: '',
    });
    const { setData: setEditData, reset: resetEditForm, clearErrors: clearEditErrors } = editForm;
    const deleteForm = useForm({});
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [permissionBeingEdited, setPermissionBeingEdited] =
        useState<PermissionSummary | null>(null);

    useEffect(() => {
        if (isEditOpen && permissionBeingEdited) {
            setEditData('name', permissionBeingEdited.name);
        }

        if (!isEditOpen) {
            resetEditForm();
            clearEditErrors();
        }
    }, [clearEditErrors, isEditOpen, permissionBeingEdited, resetEditForm, setEditData]);

    const permissionControls = useTableControls(permissions, {
        searchFields: [(permission) => permission.name],
        filters: [
            { label: 'All permissions', value: 'all' },
            {
                label: 'Protected',
                value: 'protected',
                predicate: (permission) => permission.is_protected,
            },
            {
                label: 'Unused',
                value: 'unused',
                predicate: (permission) => permission.roles_count === 0,
            },
        ],
        initialPageSize: 10,
    });

    const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        createForm.post('/master/permissions', {
            preserveScroll: true,
            onSuccess: () => createForm.reset(),
        });
    };

    const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!permissionBeingEdited) {
            return;
        }

        editForm.put(`/master/permissions/${permissionBeingEdited.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsEditOpen(false);
                setPermissionBeingEdited(null);
            },
        });
    };

    const handleDelete = (permission: PermissionSummary) => {
        if (permission.is_protected) {
            return;
        }

        if (
            window.confirm(
                `Delete the "${permission.name}" permission? This action cannot be undone.`,
            )
        ) {
            deleteForm.delete(`/master/permissions/${permission.id}`, {
                preserveScroll: true,
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Permissions" />

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
                    <section className="space-y-6 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                        <header className="space-y-2">
                            <div className="flex items-center gap-2">
                                <KeyRound className="h-5 w-5" />
                                <h2 className="text-lg font-semibold">Create permission</h2>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Add a new permission that can be assigned to roles.
                            </p>
                        </header>

                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor="permission-name">
                                    Permission name
                                </label>
                                <Input
                                    id="permission-name"
                                    name="name"
                                    placeholder="e.g. manage orders"
                                    value={createForm.data.name}
                                    onChange={(event) =>
                                        createForm.setData('name', event.target.value)
                                    }
                                    autoComplete="off"
                                />
                                <InputError message={createForm.errors.name} />
                            </div>

                            <Button type="submit" disabled={createForm.processing} className="w-full">
                                Create permission
                            </Button>
                        </form>
                    </section>

                    <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Existing permissions</h2>
                                <p className="text-sm text-muted-foreground">
                                    Rename or remove permissions that are no longer needed.
                                </p>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {permissionControls.total} permission{permissionControls.total === 1 ? '' : 's'}
                            </span>
                        </header>

                        <TableToolbar
                            searchTerm={permissionControls.searchTerm}
                            onSearchChange={permissionControls.setSearchTerm}
                            searchPlaceholder="Search by permission name"
                            filterOptions={permissionControls.filterOptions}
                            filterValue={permissionControls.filterValue}
                            onFilterChange={permissionControls.setFilterValue}
                            pageSize={permissionControls.pageSize}
                            pageSizeOptions={permissionControls.pageSizeOptions}
                            onPageSizeChange={permissionControls.setPageSize}
                            total={permissionControls.total}
                            filteredTotal={permissionControls.filteredTotal}
                        />

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">Permission</th>
                                        <th className="px-3 py-2 text-right">Roles using</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {permissionControls.total === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                                                No permissions created yet.
                                            </td>
                                        </tr>
                                    ) : permissionControls.filteredTotal === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                                                No permissions match the applied search or filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        permissionControls.items.map((permission) => (
                                            <tr key={permission.id} className="border-b border-muted/50 last:border-b-0">
                                                <td className="px-3 py-3 align-top">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-medium">{permission.name}</span>
                                                            {permission.is_protected && (
                                                                <Badge variant="secondary" className="uppercase">
                                                                    Protected
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-right align-top">
                                                    {permission.roles_count.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-2">
                                                        <Dialog
                                                            open={isEditOpen && permissionBeingEdited?.id === permission.id}
                                                            onOpenChange={(open) => {
                                                                setIsEditOpen(open);
                                                                if (open) {
                                                                    setPermissionBeingEdited(permission);
                                                                }
                                                            }}
                                                        >
                                                            <DialogTrigger asChild>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setPermissionBeingEdited(permission);
                                                                        setIsEditOpen(true);
                                                                    }}
                                                                >
                                                                    <Pencil className="mr-2 h-4 w-4" />
                                                                    Edit
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent>
                                                                <DialogHeader>
                                                                    <DialogTitle>Edit permission</DialogTitle>
                                                                    <DialogDescription>
                                                                        Update the permission name. Changes are applied immediately.
                                                                    </DialogDescription>
                                                                </DialogHeader>

                                                                <form onSubmit={handleEditSubmit} className="space-y-4">
                                                                    <div className="space-y-2">
                                                                        <label className="text-sm font-medium" htmlFor="edit-permission-name">
                                                                            Permission name
                                                                        </label>
                                                                        <Input
                                                                            id="edit-permission-name"
                                                                            value={editForm.data.name}
                                                                            onChange={(event) =>
                                                                                editForm.setData('name', event.target.value)
                                                                            }
                                                                        />
                                                                        <InputError message={editForm.errors.name} />
                                                                    </div>

                                                                    <DialogFooter>
                                                                        <Button type="button" variant="secondary" onClick={() => setIsEditOpen(false)}>
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
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleDelete(permission)}
                                                            disabled={permission.is_protected || deleteForm.processing}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
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
                            page={permissionControls.page}
                            pageCount={permissionControls.pageCount}
                            onPageChange={permissionControls.goToPage}
                            range={permissionControls.range}
                            total={permissionControls.total}
                            filteredTotal={permissionControls.filteredTotal}
                        />
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}

