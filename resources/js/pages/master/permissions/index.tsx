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
import AppLayout from '@/layouts/app-layout';
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
                                {permissions.length} permission{permissions.length === 1 ? '' : 's'}
                            </span>
                        </header>

                        {permissions.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-sidebar-border/70 p-6 text-sm text-muted-foreground text-center dark:border-sidebar-border">
                                No permissions created yet.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {permissions.map((permission) => (
                                    <article
                                        key={permission.id}
                                        className="flex flex-col gap-4 rounded-lg border border-sidebar-border/60 bg-background p-4 shadow-sm transition hover:border-sidebar-border dark:border-sidebar-border sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-semibold leading-tight">
                                                    {permission.name}
                                                </h3>
                                                {permission.is_protected && (
                                                    <Badge variant="secondary" className="uppercase">
                                                        Protected
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                {permission.roles_count} role{permission.roles_count === 1 ? '' : 's'} using this permission
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
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
                                                            <Button
                                                                type="button"
                                                                variant="secondary"
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
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDelete(permission)}
                                                disabled={permission.is_protected || deleteForm.processing}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </Button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}

