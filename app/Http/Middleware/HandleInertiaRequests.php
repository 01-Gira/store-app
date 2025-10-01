<?php

namespace App\Http\Middleware;

use App\Models\StoreSetting;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        $user = $request->user();

        if ($user) {
            // $user->setAttribute('permissions', $user->getAllPermissions()->pluck('name')->all());
            // $user->setAttribute('roles', $user->getRoleNames()->all());
             $sharedUser = [
                ...$user->toArray(),
                'permissions' => $user->getAllPermissions()->pluck('name')->all(),
                'roles' => $user->getRoleNames()->all(),
            ];
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $sharedUser ?? null,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            'storeSettings' => static function () {
                $settings = StoreSetting::current();

                return [
                    'currency_code' => $settings->currency_code,
                    'currency_symbol' => $settings->currency_symbol,
                    'language_code' => $settings->language_code,
                    'timezone' => $settings->timezone,
                ];
            },
        ];
    }
}
