<?php

namespace App\Http\Controllers\Master;

use App\Http\Controllers\Controller;
use App\Http\Requests\Master\StoreUserRequest;
use App\Http\Requests\Master\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

class UserController extends Controller implements HasMiddleware
{
    /**
     * Users that cannot be removed from the system.
     *
     * @var array<int, string>
     */
    private const PROTECTED_USERS = ['test@example.com'];

    /**
     * Get the middleware that should be assigned to the controller.
     */
    public static function middleware(): array
    {
        return [new Middleware('can:manage users')];
    }

    /**
     * Display the user management screen.
     */
    public function index(): Response
    {
        $users = User::query()
            ->with(['roles:id,name'])
            ->orderBy('name')
            ->get()
            ->map(static function (User $user): array {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified_at' => $user->email_verified_at?->toIso8601String(),
                    'two_factor_enabled' => $user->two_factor_secret !== null,
                    'roles' => $user->roles
                        ->map(static fn (Role $role) => [
                            'id' => $role->id,
                            'name' => $role->name,
                        ])
                        ->values()
                        ->all(),
                    'is_protected' => in_array($user->email, self::PROTECTED_USERS, true),
                ];
            });

        $roles = Role::query()
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(static fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
            ]);

        return Inertia::render('master/users/index', [
            'users' => $users,
            'roles' => $roles,
        ]);
    }

    /**
     * Store a newly created user in storage.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
        ]);

        $user->syncRoles($this->roleIds($request->input('roles', [])));

        return back()->with('success', 'User created successfully.');
    }

    /**
     * Update the specified user in storage.
     */
    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $attributes = [
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
        ];

        if ($request->filled('password')) {
            $attributes['password'] = $request->string('password')->toString();
        }

        $user->update($attributes);

        $user->syncRoles($this->roleIds($request->input('roles', [])));

        return back()->with('success', 'User updated successfully.');
    }

    /**
     * Remove the specified user from storage.
     */
    public function destroy(User $user): RedirectResponse
    {
        if (in_array($user->email, self::PROTECTED_USERS, true)) {
            return back()->with('error', 'This user cannot be deleted.');
        }

        if (request()->user()?->is($user)) {
            return back()->with('error', 'You cannot delete your own account.');
        }

        $user->delete();

        return back()->with('success', 'User deleted successfully.');
    }

    /**
     * Normalise role IDs from the request payload.
     *
     * @param  array<int, int|string>  $roles
     * @return array<int, int>
     */
    private function roleIds(array $roles): array
    {
        return collect($roles)
            ->map(static fn ($role) => (int) $role)
            ->filter()
            ->values()
            ->all();
    }
}
