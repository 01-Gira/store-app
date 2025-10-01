import InputError from '@/components/input-error';
import { TablePagination, TableToolbar } from '@/components/table-controls';
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
import { useTableControls } from '@/hooks/use-table-controls';
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

    const roleControls = useTableControls(roles, {
        searchFields: [
            (role) => role.name,
            (role) => role.permissions.map((permission) => permission.name).join(' '),
        ],
        filters: [
            { label: 'All roles', value: 'all' },
            {
                label: 'Protected roles',
                value: 'protected',
                predicate: (role) => role.is_protected,
            },
            {
                label: 'Roles without users',
                value: 'without-users',
                predicate: (role) => role.users_count === 0,
            },
        ],
        initialPageSize: 10,
    });

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
                                    Assign and manage role permissions for your team.
                                </p>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {roleControls.total} role{roleControls.total === 1 ? '' : 's'}
                            </span>
                        </header>

                        <TableToolbar
                            searchTerm={roleControls.searchTerm}
                            onSearchChange={roleControls.setSearchTerm}
                            searchPlaceholder="Search by role or permission name"
                            filterOptions={roleControls.filterOptions}
                            filterValue={roleControls.filterValue}
                            onFilterChange={roleControls.setFilterValue}
                            pageSize={roleControls.pageSize}
                            pageSizeOptions={roleControls.pageSizeOptions}
                            onPageSizeChange={roleControls.setPageSize}
                            total={roleControls.total}
                            filteredTotal={roleControls.filteredTotal}
                        />

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-sm">
                                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2">Role</th>
                                        <th className="px-3 py-2">Permissions</th>
                                        <th className="px-3 py-2 text-right">Users</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {roleControls.total === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                                                No roles created yet.
                                            </td>
                                        </tr>
                                    ) : roleControls.filteredTotal === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                                                No roles match the applied search or filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        roleControls.items.map((role) => (
                                            <tr key={role.id} className="border-b border-muted/50 last:border-b-0">
                                                <td className="px-3 py-3 align-top">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-medium">{role.name}</span>
                                                            {role.is_protected && (
                                                                <Badge variant="secondary" className="uppercase">
                                                                    Protected
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            Assigned to {role.users_count} user{role.users_count === 1 ? '' : 's'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 align-top">
                                                    {role.permissions.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {role.permissions.map((permission) => (
                                                                <Badge key={`${role.id}-${permission.id}`} variant="secondary">
                                                                    {permission.name}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">No permissions assigned</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right align-top">{role.users_count}</td>
                                                <td className="px-3 py-3">
                                                    <div className="flex justify-end gap-2">
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
                                                                        Update the role name or adjust permission assignments.
                                                                    </DialogDescription>
                                                                </DialogHeader>

                                                                <form onSubmit={handleEditSubmit} className="space-y-4">
                                                                    <div className="space-y-2">
                                                                        <Label htmlFor="edit-role-name">Role name</Label>
                                                                        <Input
                                                                            id="edit-role-name"
                                                                            value={editForm.data.name}
                                                                            onChange={(event) =>
                                                                                editForm.setData('name', event.target.value)
                                                                            }
                                                                            autoComplete="off"
                                                                        />
                                                                        <InputError message={editForm.errors.name} />
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center justify-between">
                                                                            <Label>Permissions</Label>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {editForm.data.permissions.length} of {totalPermissions} selected
                                                                            </span>
                                                                        </div>

                                                                        <div className="grid gap-2">
                                                                            {permissions.map((permission) => (
                                                                                <label
                                                                                    key={permission.id}
                                                                                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-sidebar-border/70"
                                                                                >
                                                                                    <Checkbox
                                                                                        checked={editForm.data.permissions.includes(permission.id)}
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
                                                                                    <span className="text-sm font-medium">{permission.name}</span>
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                        <InputError message={editForm.errors.permissions} />
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
                                                            onClick={() => handleDelete(role)}
                                                            disabled={role.is_protected || deleteForm.processing}
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
                            page={roleControls.page}
                            pageCount={roleControls.pageCount}
                            onPageChange={roleControls.goToPage}
                            range={roleControls.range}
                            total={roleControls.total}
                            filteredTotal={roleControls.filteredTotal}
                        />
                    </section>
                </div>
            </div>
        </AppLayout>
    );
}

