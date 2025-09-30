<?php

namespace App\Http\Controllers\Master;

use App\Http\Controllers\Controller;
use App\Http\Requests\Master\StoreRoleRequest;
use App\Http\Requests\Master\UpdateRoleRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller implements HasMiddleware
{
    /**
     * Roles that cannot be removed from the system.
     *
     * @var array<int, string>
     */
    private const PROTECTED_ROLES = ['Administrator'];

    /**
     * Get the middleware that should be assigned to the controller.
     */
    public static function middleware(): array
    {
        return [new Middleware('can:manage roles')];
    }

    /**
     * Display the role management screen.
     */
    public function index(): Response
    {
        $roles = Role::query()
            ->with(['permissions:id,name'])
            ->withCount('users')
            ->orderBy('name')
            ->get()
            ->map(static function (Role $role): array {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'users_count' => $role->users_count,
                    'permissions' => $role->permissions
                        ->map(static fn (Permission $permission) => [
                            'id' => $permission->id,
                            'name' => $permission->name,
                        ])
                        ->values()
                        ->all(),
                    'is_protected' => in_array($role->name, self::PROTECTED_ROLES, true),
                ];
            });

        $permissions = Permission::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(static fn (Permission $permission) => [
                'id' => $permission->id,
                'name' => $permission->name,
            ]);

        return Inertia::render('master/roles/index', [
            'roles' => $roles,
            'permissions' => $permissions,
        ]);
    }

    /**
     * Store a newly created role in storage.
     */
    public function store(StoreRoleRequest $request): RedirectResponse
    {
        $role = Role::query()->create([
            'name' => $request->string('name')->toString(),
            'guard_name' => 'web',
        ]);

        $role->syncPermissions($this->permissionIds($request->input('permissions', [])));

        return back()->with('success', 'Role created successfully.');
    }

    /**
     * Update the specified role in storage.
     */
    public function update(UpdateRoleRequest $request, Role $role): RedirectResponse
    {
        $role->update([
            'name' => $request->string('name')->toString(),
        ]);

        $role->syncPermissions($this->permissionIds($request->input('permissions', [])));

        return back()->with('success', 'Role updated successfully.');
    }

    /**
     * Remove the specified role from storage.
     */
    public function destroy(Role $role): RedirectResponse
    {
        if (in_array($role->name, self::PROTECTED_ROLES, true)) {
            return back()->with('error', 'The Administrator role cannot be deleted.');
        }

        $role->delete();

        return back()->with('success', 'Role deleted successfully.');
    }

    /**
     * Normalise permission IDs from the request payload.
     *
     * @param  array<int, int|string>  $permissions
     * @return array<int, int>
     */
    private function permissionIds(array $permissions): array
    {
        return collect($permissions)
            ->map(static fn ($permission) => (int) $permission)
            ->filter()
            ->values()
            ->all();
    }
}

