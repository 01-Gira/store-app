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
import {
    CheckCircle2,
    Clock,
    Mail,
    PlusCircle,
    ShieldCheck,
    ShieldOff,
    Trash2,
    UserPlus,
} from 'lucide-react';

interface RoleSummary {
    id: number;
    name: string;
}

interface UserSummary {
    id: number;
    name: string;
    email: string;
    email_verified_at: string | null;
    two_factor_enabled: boolean;
    roles: RoleSummary[];
    is_protected: boolean;
}

interface UsersPageProps {
    users: UserSummary[];
    roles: RoleSummary[];
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: '/master/users',
    },
];

const applyRoleSelection = (selected: number[], roleId: number, isChecked: boolean) => {
    if (isChecked) {
        return selected.includes(roleId) ? selected : [...selected, roleId];
    }

    return selected.filter((id) => id !== roleId);
};

export default function UsersIndex({ users, roles }: UsersPageProps) {
    const { flash, auth } = usePage<SharedData>().props;
    const currentUserId = auth.user.id;

    const createForm = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        roles: [] as number[],
    });

    const editForm = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        roles: [] as number[],
    });

    const deleteForm = useForm({});

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [userBeingEdited, setUserBeingEdited] = useState<UserSummary | null>(null);

    const { setData: setEditData, reset: resetEditForm, clearErrors: clearEditErrors } = editForm;

    useEffect(() => {
        if (isEditOpen && userBeingEdited) {
            setEditData('name', userBeingEdited.name);
            setEditData('email', userBeingEdited.email);
            setEditData(
                'roles',
                userBeingEdited.roles.map((role) => role.id),
            );
            setEditData('password', '');
            setEditData('password_confirmation', '');
        }

        if (!isEditOpen) {
            resetEditForm();
            clearEditErrors();
        }
    }, [clearEditErrors, isEditOpen, resetEditForm, setEditData, userBeingEdited]);

    const totalRoles = useMemo(() => roles.length, [roles.length]);

    const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        createForm.post('/master/users', {
            preserveScroll: true,
            onSuccess: () => createForm.reset(),
        });
    };

    const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!userBeingEdited) {
            return;
        }

        editForm.put(`/master/users/${userBeingEdited.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsEditOpen(false);
                setUserBeingEdited(null);
            },
        });
    };

    const handleDelete = (user: UserSummary) => {
        if (user.is_protected || user.id === currentUserId) {
            return;
        }

        if (window.confirm(`Delete ${user.name}? This action cannot be undone.`)) {
            deleteForm.delete(`/master/users/${user.id}`, {
                preserveScroll: true,
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Users" />

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
                                <UserPlus className="h-5 w-5" />
                                <h2 className="text-lg font-semibold">Create user</h2>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Invite a new teammate and choose which roles they should have access to.
                            </p>
                        </header>

                        <form onSubmit={handleCreateSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="user-name">Name</Label>
                                <Input
                                    id="user-name"
                                    name="name"
                                    placeholder="e.g. Jane Doe"
                                    value={createForm.data.name}
                                    onChange={(event) => createForm.setData('name', event.target.value)}
                                    autoComplete="off"
                                />
                                <InputError message={createForm.errors.name} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="user-email">Email</Label>
                                <Input
                                    id="user-email"
                                    name="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={createForm.data.email}
                                    onChange={(event) => createForm.setData('email', event.target.value)}
                                    autoComplete="off"
                                />
                                <InputError message={createForm.errors.email} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="user-password">Password</Label>
                                <Input
                                    id="user-password"
                                    name="password"
                                    type="password"
                                    value={createForm.data.password}
                                    onChange={(event) => createForm.setData('password', event.target.value)}
                                    autoComplete="new-password"
                                />
                                <InputError message={createForm.errors.password} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="user-password-confirmation">Confirm password</Label>
                                <Input
                                    id="user-password-confirmation"
                                    name="password_confirmation"
                                    type="password"
                                    value={createForm.data.password_confirmation}
                                    onChange={(event) =>
                                        createForm.setData('password_confirmation', event.target.value)
                                    }
                                    autoComplete="new-password"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Roles</Label>
                                    <span className="text-xs text-muted-foreground">
                                        {createForm.data.roles.length} of {totalRoles} selected
                                    </span>
                                </div>

                                {roles.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-sidebar-border/70 p-3 text-sm text-muted-foreground dark:border-sidebar-border">
                                        Create roles first to assign them to users.
                                    </p>
                                ) : (
                                    <div className="grid gap-2">
                                        {roles.map((role) => (
                                            <label
                                                key={role.id}
                                                className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-sidebar-border/70"
                                            >
                                                <Checkbox
                                                    checked={createForm.data.roles.includes(role.id)}
                                                    onCheckedChange={(checked) =>
                                                        createForm.setData(
                                                            'roles',
                                                            applyRoleSelection(
                                                                createForm.data.roles,
                                                                role.id,
                                                                checked === true,
                                                            ),
                                                        )
                                                    }
                                                />
                                                <span className="text-sm font-medium">{role.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                <InputError message={createForm.errors.roles} />
                            </div>

                            <Button type="submit" disabled={createForm.processing} className="w-full">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Save user
                            </Button>
                        </form>
                    </section>

                    <section className="space-y-4 rounded-xl border border-sidebar-border/70 bg-card p-6 shadow-sm dark:border-sidebar-border">
                        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">Existing users</h2>
                                <p className="text-sm text-muted-foreground">
                                    Review access and manage user roles.
                                </p>
                            </div>
                            <span className="text-sm text-muted-foreground">
                                {users.length} user{users.length === 1 ? '' : 's'}
                            </span>
                        </header>

                        {users.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-sidebar-border/70 p-6 text-center text-sm text-muted-foreground dark:border-sidebar-border">
                                No users available yet.
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {users.map((user) => (
                                    <article
                                        key={user.id}
                                        className="space-y-3 rounded-lg border border-sidebar-border/60 bg-background p-4 shadow-sm transition hover:border-sidebar-border dark:border-sidebar-border"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-2">
                                                <div>
                                                    <h3 className="text-base font-semibold leading-tight">{user.name}</h3>
                                                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                                        <Mail className="h-4 w-4" />
                                                        {user.email}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    {user.email_verified_at ? (
                                                        <Badge
                                                            variant="secondary"
                                                            className="border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100"
                                                        >
                                                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                                            Email verified
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="secondary"
                                                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100"
                                                        >
                                                            <Clock className="mr-1 h-3.5 w-3.5" />
                                                            Verification pending
                                                        </Badge>
                                                    )}

                                                    {user.two_factor_enabled ? (
                                                        <Badge
                                                            variant="secondary"
                                                            className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100"
                                                        >
                                                            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                                                            2FA enabled
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="secondary"
                                                            className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-900/40 dark:bg-slate-900/20 dark:text-slate-100"
                                                        >
                                                            <ShieldOff className="mr-1 h-3.5 w-3.5" />
                                                            2FA disabled
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <Dialog
                                                    open={isEditOpen && userBeingEdited?.id === user.id}
                                                    onOpenChange={(open) => {
                                                        setIsEditOpen(open);
                                                        if (open) {
                                                            setUserBeingEdited(user);
                                                        }
                                                    }}
                                                >
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setUserBeingEdited(user);
                                                                setIsEditOpen(true);
                                                            }}
                                                        >
                                                            Edit
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Edit user</DialogTitle>
                                                            <DialogDescription>
                                                                Update account details or adjust role assignments.
                                                            </DialogDescription>
                                                        </DialogHeader>

                                                        <form onSubmit={handleEditSubmit} className="space-y-4">
                                                            <div className="space-y-2">
                                                                <Label htmlFor="edit-user-name">Name</Label>
                                                                <Input
                                                                    id="edit-user-name"
                                                                    value={editForm.data.name}
                                                                    onChange={(event) =>
                                                                        editForm.setData('name', event.target.value)
                                                                    }
                                                                />
                                                                <InputError message={editForm.errors.name} />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label htmlFor="edit-user-email">Email</Label>
                                                                <Input
                                                                    id="edit-user-email"
                                                                    type="email"
                                                                    value={editForm.data.email}
                                                                    onChange={(event) =>
                                                                        editForm.setData('email', event.target.value)
                                                                    }
                                                                />
                                                                <InputError message={editForm.errors.email} />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label htmlFor="edit-user-password">New password</Label>
                                                                <Input
                                                                    id="edit-user-password"
                                                                    type="password"
                                                                    value={editForm.data.password}
                                                                    onChange={(event) =>
                                                                        editForm.setData('password', event.target.value)
                                                                    }
                                                                    autoComplete="new-password"
                                                                />
                                                                <InputError message={editForm.errors.password} />
                                                            </div>

                                                            <div className="space-y-2">
                                                                <Label htmlFor="edit-user-password-confirmation">Confirm new password</Label>
                                                                <Input
                                                                    id="edit-user-password-confirmation"
                                                                    type="password"
                                                                    value={editForm.data.password_confirmation}
                                                                    onChange={(event) =>
                                                                        editForm.setData(
                                                                            'password_confirmation',
                                                                            event.target.value,
                                                                        )
                                                                    }
                                                                    autoComplete="new-password"
                                                                />
                                                            </div>

                                                            <div className="space-y-3">
                                                                <Label>Roles</Label>
                                                                <div className="grid gap-2">
                                                                    {roles.map((role) => (
                                                                        <label
                                                                            key={role.id}
                                                                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition hover:border-sidebar-border/70"
                                                                        >
                                                                            <Checkbox
                                                                                checked={editForm.data.roles.includes(role.id)}
                                                                                onCheckedChange={(checked) =>
                                                                                    editForm.setData(
                                                                                        'roles',
                                                                                        applyRoleSelection(
                                                                                            editForm.data.roles,
                                                                                            role.id,
                                                                                            checked === true,
                                                                                        ),
                                                                                    )
                                                                                }
                                                                            />
                                                                            <span className="text-sm font-medium">{role.name}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                                <InputError message={editForm.errors.roles} />
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
                                                    onClick={() => handleDelete(user)}
                                                    disabled={
                                                        user.is_protected ||
                                                        user.id === currentUserId ||
                                                        deleteForm.processing
                                                    }
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>

                                        {user.roles.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {user.roles.map((role) => (
                                                    <Badge key={`${user.id}-${role.id}`} variant="secondary">
                                                        {role.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">No roles assigned.</p>
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
