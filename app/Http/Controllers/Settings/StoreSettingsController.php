<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateStoreSettingsRequest;
use App\Models\StoreSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
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
                'updated_at' => $settings->updated_at?->toIso8601String(),
            ],
        ]);
    }

    public function update(UpdateStoreSettingsRequest $request): RedirectResponse
    {
        $settings = StoreSetting::current();
        $settings->update([
            'ppn_rate' => $request->float('ppn_rate'),
        ]);

        return Redirect::back()->with('success', 'Store settings updated successfully.');
    }
}
