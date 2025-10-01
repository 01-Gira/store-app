<?php

namespace App\Http\Controllers;

use App\Services\DashboardMetricsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private readonly DashboardMetricsService $metricsService)
    {
    }

    public function __invoke(Request $request): Response
    {
        $defaultDays = (int) config('store.dashboard.default_range_days', 14);
        $maxDays = (int) config('store.dashboard.max_range_days', 90);
        $days = (int) max(1, min($maxDays, $request->integer('days', $defaultDays)));
        $cacheMinutes = (int) config('store.dashboard.cache_minutes', 5);
        $cacheKey = sprintf('dashboard:metrics:%d', $days);

        $metrics = Cache::remember(
            $cacheKey,
            now()->addMinutes($cacheMinutes),
            fn () => $this->metricsService->build($days)
        );

        return Inertia::render('dashboard', [
            'metrics' => $metrics,
        ]);
    }
}
