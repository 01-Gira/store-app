<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateStoreSettingsRequest;
use App\Models\StoreSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class StoreSettingsController extends Controller
{
    public function edit(): Response
    {
        $settings = StoreSetting::current();

        return Inertia::render('settings/store', [
            'settings' => [
                'ppn_rate' => (float) $settings->ppn_rate,
                'store_name' => $settings->store_name ?? '',
                'contact_details' => $settings->contact_details,
                'receipt_footer_text' => $settings->receipt_footer_text,
                'currency_code' => $settings->currency_code,
                'currency_symbol' => $settings->currency_symbol,
                'language_code' => $settings->language_code,
                'timezone' => $settings->timezone,
                'logo_url' => $settings->logo_path
                    ? Storage::disk('public')->url($settings->logo_path)
                    : null,
                'updated_at' => $settings->updated_at?->toIso8601String(),
            ],
        ]);
    }

    public function update(UpdateStoreSettingsRequest $request): RedirectResponse
    {
        $settings = StoreSetting::current();
        $storeName = $request->string('store_name')->trim()->toString();
        $contactDetails = $request->filled('contact_details')
            ? (string) $request->input('contact_details')
            : null;
        $receiptFooter = $request->filled('receipt_footer_text')
            ? (string) $request->input('receipt_footer_text')
            : null;
        $currencyCode = $request->string('currency_code')->trim()->upper()->toString();
        $currencySymbol = $request->string('currency_symbol')->trim()->toString();
        $languageCode = $request->string('language_code')->trim()->toString();
        $timezone = $request->string('timezone')->trim()->toString();

        $payload = [
            'ppn_rate' => $request->float('ppn_rate'),
            'store_name' => $storeName,
            'contact_details' => $contactDetails,
            'receipt_footer_text' => $receiptFooter,
            'currency_code' => $currencyCode,
            'currency_symbol' => $currencySymbol,
            'language_code' => $languageCode,
            'timezone' => $timezone,
        ];

        if ($request->boolean('remove_logo') && $settings->logo_path) {
            Storage::disk('public')->delete($settings->logo_path);
            $payload['logo_path'] = null;
        }

        if ($request->hasFile('logo')) {
            if ($settings->logo_path) {
                Storage::disk('public')->delete($settings->logo_path);
            }

            $payload['logo_path'] = $request->file('logo')->store('branding', 'public');
        }

        $settings->update($payload);

        return Redirect::back()->with('success', 'Store settings updated successfully.');
    }
}
