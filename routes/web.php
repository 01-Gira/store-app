<?php

use App\Http\Controllers\Inventory\PurchaseOrderController;
use App\Http\Controllers\Inventory\SupplierController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Master\PermissionController;
use App\Http\Controllers\Master\ProductController;
use App\Http\Controllers\Master\RoleController;
use App\Http\Controllers\Master\UserController;
use App\Http\Controllers\Transactions\TransactionController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::prefix('transactions')->name('transactions.')->group(function () {
        Route::get('employee', [TransactionController::class, 'employee'])->name('employee');
        Route::post('/', [TransactionController::class, 'store'])->name('store');
        Route::get('products/{product:barcode}', [TransactionController::class, 'showProduct'])->name('products.show');
        Route::get('customer/latest', [TransactionController::class, 'latest'])->name('customer.latest');
        Route::get('customer/{transaction}', [TransactionController::class, 'customer'])->name('customer');
        Route::get('history', [TransactionController::class, 'history'])->name('history');
    });

    Route::prefix('master')->name('master.')->group(function () {
        Route::resource('roles', RoleController::class)->except(['create', 'edit', 'show']);
        Route::resource('permissions', PermissionController::class)->except(['create', 'edit', 'show']);
        Route::resource('users', UserController::class)->except(['create', 'edit', 'show']);
        Route::resource('products', ProductController::class)->except(['create', 'edit', 'show']);
        Route::post('products/import', [ProductController::class, 'import'])->name('products.import');
        Route::get('products/export', [ProductController::class, 'export'])->name('products.export');
    });

    Route::prefix('inventory')->name('inventory.')->group(function () {
        Route::resource('suppliers', SupplierController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::resource('purchase-orders', PurchaseOrderController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::post('purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])
            ->name('purchase-orders.receive');
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
