<?php

use App\Http\Controllers\Master\PermissionController;
use App\Http\Controllers\Master\ProductController;
use App\Http\Controllers\Master\RoleController;
use App\Http\Controllers\Master\UserController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::prefix('master')->name('master.')->group(function () {
        Route::resource('roles', RoleController::class)->except(['create', 'edit', 'show']);
        Route::resource('permissions', PermissionController::class)->except(['create', 'edit', 'show']);
        Route::resource('users', UserController::class)->except(['create', 'edit', 'show']);
        Route::resource('products', ProductController::class)->except(['create', 'edit', 'show']);
        Route::post('products/import', [ProductController::class, 'import'])->name('products.import');
        Route::get('products/export', [ProductController::class, 'export'])->name('products.export');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
