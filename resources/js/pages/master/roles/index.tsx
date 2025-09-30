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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { PlusCircle, Shield, Trash2 } from 'lucide-react';

interface PermissionSummary {
    id: number;
    name: string;
}

interface RoleSummary {
    id: number;
    name: string;
    users_count: number;
    permissions: PermissionSummary[];
    is_protected: boolean;
}

interface RolesPageProps {
    roles: RoleSummary[];
    permissions: PermissionSummary[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Roles',
        href: '/master/roles',
    },
];

const applyPermissionSelection = (
    selected: number[],
    permissionId: number,
    isChecked: boolean,
) => {
    if (isChecked) {
        return selected.includes(permissionId)
            ? selected
            : [...selected, permissionId];
    }

    return selected.filter((id) => id !== permissionId);
};

export default function RolesIndex({
    roles,
    permissions,
}: RolesPageProps) {
    const { flash } = usePage<SharedData>().props;
    const createForm = useForm({
        name: '',
        permissions: [] as number[],
    });
    const editForm = useForm({
        name: '',
        permissions: [] as number[],
    });
    const { setData: setEditData, reset: resetEditForm, clearErrors: clearEditErrors } = editForm;
    const deleteForm = useForm({});
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [roleBeingEdited, setRoleBeingEdited] = useState<RoleSummary | null>(
        null,
    );

    useEffect(() => {
        if (isEditOpen && roleBeingEdited) {
            setEditData('name', roleBeingEdited.name);
            setEditData(
                'permissions',
                roleBeingEdited.permissions.map((permission) => permission.id),
            );
        }

        if (!isEditOpen) {
            resetEditForm();
            clearEditErrors();
        }
    }, [clearEditErrors, isEditOpen, resetEditForm, roleBeingEdited, setEditData]);

    const totalPermissions = useMemo(() => permissions.length, [permissions.length]);

    const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        createForm.post('/master/roles', {
            preserveScroll: true,
            onSuccess: () => createForm.reset(),
        });
    };

    const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!roleBeingEdited) {
            return;
        }

        editForm.put(`/master/roles/${roleBeingEdited.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsEditOpen(false);
                setRoleBeingEdited(null);
            },
        });
    };

    const handleDelete = (role: RoleSummary) => {
        if (role.is_protected) {
            return;
        }

        if (
            window.confirm(
                `Delete the ${role.name} role? This will remove it from all users.`,
            )
        ) {
            deleteForm.delete(`/master/roles/${role.id}`, {
                preserveScroll: true,
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Roles" />

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
                                <Shield className="h-5 w-5" />
                                <h2 className="text-lg font-semibold">Create role</h2>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Define a new role and choose which permissions it should have access to.
                            </p>
                        </header>

                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="role-name">Role name</Label>
                                <Input
                                    id="role-name"
                                    name="name"
                                    placeholder="e.g. Support Agent"
                                    value={createForm.data.name}
                                    onChange={(event) =>
                                        createForm.setData('name', event.target.value)
                                    }
                                    autoComplete="off"
                                />
                                <InputError message={createForm.errors.name} />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Permissions</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {createForm.data.permissions.length} of {totalPermissions} selected
                                    </span>
                                </div>

                                {permissions.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-sidebar-border/70 p-3 text-sm text-muted-foreground dark:border-sidebar-border">
                                        Create permissions first to assign them to roles.
                                    </p>
                                ) : (
                                    <div className="grid gap-2">
                                        {permissions.map((permission) => (
                                            <label
                                                key={permission.id}
                                                className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-sidebar-border/70"
                                            >
                                                <Checkbox
                                                    checked={createForm.data.permissions.includes(
                                                        permission.id,
                                                    )}
                                                    onCheckedChange={(checked) =>
                                                        createForm.setData(
                                                            'permissions',
                                                            applyPermissionSelection(
                                                                createForm.data.permissions,
                                                                permission.id,
                                                                checked === true,
                                                            ),
                                                        )
                                                    }
                                                />
                                                <span className="text-sm font-medium">
                                                    {permission.name}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                <InputError message={createForm.errors.permissions} />
                            </div>

                            <Button type="submit" disabled={createForm.processing} className="w-full">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Save role
                            </Button>
                        </form>
                    </section>

                    <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Existing roles</h2>
                                <p className="text-sm text-muted-foreground">
                                    Assign permissions or make changes to existing roles.
                                </p>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {roles.length} role{roles.length === 1 ? '' : 's'}
                            </span>
                        </header>

                        {roles.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-sidebar-border/70 p-6 text-sm text-muted-foreground text-center dark:border-sidebar-border">
                                No roles created yet.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {roles.map((role) => (
                                    <article
                                        key={role.id}
                                        className="space-y-3 rounded-lg border border-sidebar-border/60 bg-background p-4 shadow-sm transition hover:border-sidebar-border dark:border-sidebar-border"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-1">
                                                <h3 className="text-base font-semibold leading-tight">
                                                    {role.name}
                                                </h3>
                                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                                    {role.users_count} user{role.users_count === 1 ? '' : 's'} assigned
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Dialog
                                                    open={isEditOpen && roleBeingEdited?.id === role.id}
                                                    onOpenChange={(open) => {
                                                        setIsEditOpen(open);
                                                        if (open) {
                                                            setRoleBeingEdited(role);
                                                        }
                                                    }}
                                                >
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setRoleBeingEdited(role);
                                                                setIsEditOpen(true);
                                                            }}
                                                        >
                                                            Edit
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Edit role</DialogTitle>
                                                            <DialogDescription>
                                                                Update the role name or adjust its permissions.
                                                            </DialogDescription>
                                                        </DialogHeader>

                                                        <form
                                                            onSubmit={handleEditSubmit}
                                                            className="space-y-4"
                                                        >
                                                            <div className="space-y-2">
                                                                <Label htmlFor="edit-role-name">
                                                                    Role name
                                                                </Label>
                                                                <Input
                                                                    id="edit-role-name"
                                                                    value={editForm.data.name}
                                                                    onChange={(event) =>
                                                                        editForm.setData(
                                                                            'name',
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                />
                                                                <InputError
                                                                    message={editForm.errors.name}
                                                                />
                                                            </div>

                                                            <div className="space-y-3">
                                                                <Label>Permissions</Label>
                                                                <div className="grid gap-2">
                                                                    {permissions.map((permission) => (
                                                                        <label
                                                                            key={permission.id}
                                                                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-sidebar-border/70"
                                                                        >
                                                                            <Checkbox
                                                                                checked={editForm.data.permissions.includes(
                                                                                    permission.id,
                                                                                )}
                                                                                onCheckedChange={(checked) =>
                                                                                    editForm.setData(
                                                                                        'permissions',
                                                                                        applyPermissionSelection(
                                                                                            editForm.data.permissions,
                                                                                            permission.id,
                                                                                            checked === true,
                                                                                        ),
                                                                                    )
                                                                                }
                                                                            />
                                                                            <span className="text-sm font-medium">
                                                                                {permission.name}
                                                                            </span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                                <InputError
                                                                    message={editForm.errors.permissions}
                                                                />
                                                            </div>

                                                            <DialogFooter>
                                                                <Button
                                                                    type="button"
                                                                    variant="secondary"
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
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(role)}
                                                    disabled={role.is_protected || deleteForm.processing}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>

                                        {role.permissions.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {role.permissions.map((permission) => (
                                                    <Badge
                                                        key={`${role.id}-${permission.id}`}
                                                        variant="secondary"
                                                    >
                                                        {permission.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">
                                                No permissions assigned to this role yet.
                                            </p>
                                        )}
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

