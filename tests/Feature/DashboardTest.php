<?php

use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $this->actingAs($user = User::factory()->create());

    $this->get(route('dashboard'))->assertOk();
});

test('dashboard metrics include supplier analytics', function () {
    Config::set('store.dashboard.cache_minutes', 0);
    Cache::flush();
    $now = CarbonImmutable::parse('2024-01-15 12:00:00');
    CarbonImmutable::setTestNow($now);
    Carbon::setTestNow($now);

    $user = User::factory()->create();
    $this->actingAs($user);

    $supplierAlpha = Supplier::factory()->create(['name' => 'Alpha Supplies']);
    $supplierBeta = Supplier::factory()->create(['name' => 'Beta Traders']);
    $supplierGamma = Supplier::factory()->create(['name' => 'Gamma Goods']);

    $alphaProduct = Product::factory()->for($supplierAlpha, 'supplier')->create(['name' => 'Alpha Widget']);
    $betaProduct = Product::factory()->for($supplierBeta, 'supplier')->create(['name' => 'Beta Widget']);
    $gammaProduct = Product::factory()->for($supplierGamma, 'supplier')->create(['name' => 'Gamma Widget']);

    $orderAlphaEarly = PurchaseOrder::factory()
        ->for($supplierAlpha)
        ->create([
            'reference' => 'PO-ALPHA-1',
            'status' => PurchaseOrder::STATUS_RECEIVED,
            'ordered_at' => CarbonImmutable::parse('2024-01-01 08:00:00'),
            'expected_date' => CarbonImmutable::parse('2024-01-10'),
            'received_at' => CarbonImmutable::parse('2024-01-09 09:00:00'),
            'created_at' => CarbonImmutable::parse('2024-01-01 08:00:00'),
            'updated_at' => CarbonImmutable::parse('2024-01-09 09:00:00'),
        ]);

    PurchaseOrderItem::factory()
        ->for($orderAlphaEarly, 'purchaseOrder')
        ->for($alphaProduct, 'product')
        ->create([
            'quantity_ordered' => 10,
            'quantity_received' => 10,
            'unit_cost' => 12000,
        ]);

    $orderAlphaLate = PurchaseOrder::factory()
        ->for($supplierAlpha)
        ->create([
            'reference' => 'PO-ALPHA-2',
            'status' => PurchaseOrder::STATUS_PARTIAL,
            'ordered_at' => CarbonImmutable::parse('2024-01-03 08:00:00'),
            'expected_date' => CarbonImmutable::parse('2024-01-12'),
            'received_at' => CarbonImmutable::parse('2024-01-15 13:00:00'),
            'created_at' => CarbonImmutable::parse('2024-01-03 08:00:00'),
            'updated_at' => CarbonImmutable::parse('2024-01-15 13:00:00'),
        ]);

    PurchaseOrderItem::factory()
        ->for($orderAlphaLate, 'purchaseOrder')
        ->for($alphaProduct, 'product')
        ->create([
            'quantity_ordered' => 20,
            'quantity_received' => 18,
            'unit_cost' => 15000,
        ]);

    $orderBetaOnTime = PurchaseOrder::factory()
        ->for($supplierBeta)
        ->create([
            'reference' => 'PO-BETA-1',
            'status' => PurchaseOrder::STATUS_RECEIVED,
            'ordered_at' => CarbonImmutable::parse('2024-01-06 09:00:00'),
            'expected_date' => CarbonImmutable::parse('2024-01-08'),
            'received_at' => CarbonImmutable::parse('2024-01-08 15:00:00'),
            'created_at' => CarbonImmutable::parse('2024-01-06 09:00:00'),
            'updated_at' => CarbonImmutable::parse('2024-01-08 15:00:00'),
        ]);

    PurchaseOrderItem::factory()
        ->for($orderBetaOnTime, 'purchaseOrder')
        ->for($betaProduct, 'product')
        ->create([
            'quantity_ordered' => 12,
            'quantity_received' => 12,
            'unit_cost' => 11000,
        ]);

    $orderGammaOutstanding = PurchaseOrder::factory()
        ->for($supplierGamma)
        ->create([
            'reference' => 'PO-GAMMA-1',
            'status' => PurchaseOrder::STATUS_ORDERED,
            'ordered_at' => CarbonImmutable::parse('2024-01-05 10:00:00'),
            'expected_date' => CarbonImmutable::parse('2024-01-11'),
            'received_at' => null,
            'created_at' => CarbonImmutable::parse('2024-01-05 10:00:00'),
            'updated_at' => CarbonImmutable::parse('2024-01-05 10:00:00'),
        ]);

    PurchaseOrderItem::factory()
        ->for($orderGammaOutstanding, 'purchaseOrder')
        ->for($gammaProduct, 'product')
        ->create([
            'quantity_ordered' => 15,
            'quantity_received' => 0,
            'unit_cost' => 9000,
        ]);

    $response = $this->get(route('dashboard', ['days' => 14]));

    $response->assertInertia(function (Assert $page) {
        $page->component('dashboard')
            ->where('metrics.suppliers.summary.suppliersEvaluated', 3)
            ->where('metrics.suppliers.summary.lateDeliveryCount', 1)
            ->where('metrics.suppliers.summary.outstandingCount', 2)
            ->where('metrics.suppliers.topSuppliers.0.supplierName', 'Beta Traders')
            ->where('metrics.suppliers.topSuppliers.1.supplierName', 'Alpha Supplies')
            ->where('metrics.suppliers.lateDeliveries.0.reference', 'PO-ALPHA-2')
            ->where('metrics.suppliers.outstandingOrders.0.reference', 'PO-GAMMA-1');
    });

    CarbonImmutable::setTestNow();
    Carbon::setTestNow();
});