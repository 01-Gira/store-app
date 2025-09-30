<?php

namespace App\Http\Controllers\Master;

use App\Http\Controllers\Controller;
use App\Http\Requests\Master\StorePermissionRequest;
use App\Http\Requests\Master\UpdatePermissionRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionController extends Controller implements HasMiddleware
{
    /**
     * Permissions that should not be removed from the system.
     *
     * @var array<int, string>
     */
    private const PROTECTED_PERMISSIONS = ['manage roles', 'manage permissions', 'manage users'];

    /**
     * Get the middleware that should be assigned to the controller.
     */
    public static function middleware(): array
    {
        return [new Middleware('can:manage permissions')];
    }

    /**
     * Display the permission management screen.
     */
    public function index(): Response
    {
        $permissions = Permission::query()
            ->withCount('roles')
            ->orderBy('name')
            ->get()
            ->map(static function (Permission $permission): array {
                return [
                    'id' => $permission->id,
                    'name' => $permission->name,
                    'roles_count' => $permission->roles_count,
                    'is_protected' => in_array($permission->name, self::PROTECTED_PERMISSIONS, true),
                ];
            });

        return Inertia::render('master/permissions/index', [
            'permissions' => $permissions,
        ]);
    }

    /**
     * Store a newly created permission in storage.
     */
    public function store(StorePermissionRequest $request): RedirectResponse
    {
        $permission = Permission::query()->create([
            'name' => $request->string('name')->toString(),
            'guard_name' => 'web',
        ]);

        $administrator = Role::query()->where('name', 'Administrator')->first();

        if ($administrator !== null) {
            $administrator->givePermissionTo($permission);
        }

        return back()->with('success', 'Permission created successfully.');
    }

    /**
     * Update the specified permission in storage.
     */
    public function update(UpdatePermissionRequest $request, Permission $permission): RedirectResponse
    {
        $permission->update([
            'name' => $request->string('name')->toString(),
        ]);

        return back()->with('success', 'Permission updated successfully.');
    }

    /**
     * Remove the specified permission from storage.
     */
    public function destroy(Permission $permission): RedirectResponse
    {
        if (in_array($permission->name, self::PROTECTED_PERMISSIONS, true)) {
            return back()->with('error', 'This permission cannot be deleted.');
        }

        if ($permission->roles()->exists()) {
            return back()->with('error', 'Remove this permission from all roles before deleting it.');
        }

        $permission->delete();

        return back()->with('success', 'Permission deleted successfully.');
    }
}

