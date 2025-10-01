<?php

use App\Models\StoreSetting;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutVite();
});

test('employee transaction page includes branding data', function () {
    Storage::fake('public');

    $settings = StoreSetting::current();
    $settings->update([
        'store_name' => 'Sunrise Mart',
        'contact_details' => 'Jl. Contoh No. 1, Jakarta',
        'receipt_footer_text' => 'Terima kasih dan sampai jumpa kembali.',
        'logo_path' => 'branding/logo.png',
    ]);

    Storage::disk('public')->put('branding/logo.png', 'logo');

    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('transactions.employee'));

    $logoUrl = Storage::disk('public')->url('branding/logo.png');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('transactions/employee')
        ->where('branding.store_name', 'Sunrise Mart')
        ->where('branding.contact_details', 'Jl. Contoh No. 1, Jakarta')
        ->where('branding.receipt_footer_text', 'Terima kasih dan sampai jumpa kembali.')
        ->where('branding.logo_url', $logoUrl)
    );
});

test('customer transaction view serializes branding data', function () {
    Storage::fake('public');

    $settings = StoreSetting::current();
    $settings->update([
        'store_name' => 'Sunrise Mart',
        'contact_details' => 'Jl. Contoh No. 1, Jakarta',
        'receipt_footer_text' => 'Terima kasih dan sampai jumpa kembali.',
        'logo_path' => 'branding/logo.png',
    ]);

    Storage::disk('public')->put('branding/logo.png', 'logo');

    $user = User::factory()->create();

    $transaction = Transaction::query()->create([
        'number' => 'TRX-1001',
        'user_id' => $user->id,
        'customer_id' => null,
        'items_count' => 1,
        'ppn_rate' => $settings->ppn_rate,
        'subtotal' => 100_000,
        'tax_total' => 11_000,
        'discount_total' => 0,
        'total' => 111_000,
        'payment_method' => 'cash',
        'amount_paid' => 120_000,
        'change_due' => 9_000,
        'notes' => null,
    ]);

    TransactionItem::query()->create([
        'transaction_id' => $transaction->id,
        'product_id' => null,
        'barcode' => 'ITEM-1',
        'name' => 'Contoh Produk',
        'quantity' => 1,
        'unit_price' => 100_000,
        'tax_rate' => $settings->ppn_rate,
        'tax_amount' => 11_000,
        'line_total' => 111_000,
    ]);

    $response = $this->actingAs($user)->get(route('transactions.customer', $transaction));

    $logoUrl = Storage::disk('public')->url('branding/logo.png');

    $response->assertInertia(fn (Assert $page) => $page
        ->component('transactions/customer')
        ->where('branding.store_name', 'Sunrise Mart')
        ->where('branding.contact_details', 'Jl. Contoh No. 1, Jakarta')
        ->where('branding.receipt_footer_text', 'Terima kasih dan sampai jumpa kembali.')
        ->where('branding.logo_url', $logoUrl)
    );
});
