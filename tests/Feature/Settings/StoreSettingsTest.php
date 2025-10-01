<?php

use App\Models\StoreSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->withoutVite();
});

function createManagerUser(): User
{
    $user = User::factory()->create();
    $permission = Permission::query()->firstOrCreate([
        'name' => 'manage settings',
        'guard_name' => 'web',
    ]);

    $user->givePermissionTo($permission);

    return $user;
}

test('store managers can update branding settings with a logo', function () {
    Storage::fake('public');

    $user = createManagerUser();
    $logo = UploadedFile::fake()->image('logo.png', 200, 200);

    $response = $this
        ->actingAs($user)
        ->from(route('store.edit'))
        ->put(route('store.update'), [
            'ppn_rate' => 12.5,
            'store_name' => 'Sunrise Mart',
            'contact_details' => "Jl. Contoh No. 1\nJakarta",
            'receipt_footer_text' => 'Terima kasih atas kunjungan Anda',
            'currency_code' => 'USD',
            'currency_symbol' => '$',
            'language_code' => 'en-US',
            'timezone' => 'America/New_York',
            'logo' => $logo,
        ]);

    $response->assertRedirect(route('store.edit'))
        ->assertSessionHas('success');

    $settings = StoreSetting::current()->fresh();

    expect((float) $settings->ppn_rate)->toBe(12.5)
        ->and($settings->store_name)->toBe('Sunrise Mart')
        ->and($settings->contact_details)->toBe("Jl. Contoh No. 1\nJakarta")
        ->and($settings->receipt_footer_text)->toBe('Terima kasih atas kunjungan Anda')
        ->and($settings->currency_code)->toBe('USD')
        ->and($settings->currency_symbol)->toBe('$')
        ->and($settings->language_code)->toBe('en-US')
        ->and($settings->timezone)->toBe('America/New_York')
        ->and($settings->logo_path)->not()->toBeNull();

    Storage::disk('public')->assertExists($settings->logo_path);
});

test('store logo can be removed without uploading a replacement', function () {
    Storage::fake('public');

    $settings = StoreSetting::current();
    $settings->update([
        'store_name' => 'Sunrise Mart',
        'logo_path' => 'branding/logo.png',
    ]);

    Storage::disk('public')->put('branding/logo.png', 'logo');

    $user = createManagerUser();

    $response = $this
        ->actingAs($user)
        ->from(route('store.edit'))
        ->put(route('store.update'), [
            'ppn_rate' => 10,
            'store_name' => 'Sunrise Mart',
            'contact_details' => null,
            'receipt_footer_text' => null,
            'currency_code' => 'IDR',
            'currency_symbol' => 'Rp',
            'language_code' => 'id-ID',
            'timezone' => 'Asia/Jakarta',
            'remove_logo' => true,
        ]);

    $response->assertRedirect(route('store.edit'))
        ->assertSessionHas('success');

    $settings->refresh();

    expect($settings->logo_path)->toBeNull();
    Storage::disk('public')->assertMissing('branding/logo.png');
});
