<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        $user = User::firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        collect([
            'manage roles',
            'manage permissions',
            'manage users',
        ])->each(static function (string $name): void {
            Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        });

        $administratorRole = Role::firstOrCreate([
            'name' => 'Administrator',
            'guard_name' => 'web',
        ]);

        $administratorRole->syncPermissions(Permission::all());

        if (! $user->hasRole($administratorRole->name)) {
            $user->assignRole($administratorRole);
        }
    }
}
