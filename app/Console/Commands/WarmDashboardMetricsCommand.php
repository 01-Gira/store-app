<?php

namespace App\Console\Commands;

use App\Services\DashboardMetricsService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class WarmDashboardMetricsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'dashboard:warm {--days=* : Day ranges to warm}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Warm the cached dashboard analytics metrics for faster rendering.';

    public function handle(DashboardMetricsService $metricsService): int
    {
        $ranges = collect($this->option('days'))
            ->filter(static fn ($value) => $value !== null && $value !== '')
            ->map(static fn ($value) => (int) $value)
            ->filter(static fn (int $value) => $value > 0)
            ->unique()
            ->values();

        if ($ranges->isEmpty()) {
            $default = (int) config('store.dashboard.default_range_days', 14);
            $ranges = collect([$default, 30]);
        }

        $cacheMinutes = (int) config('store.dashboard.cache_minutes', 5);

        foreach ($ranges as $days) {
            $cacheKey = sprintf('dashboard:metrics:%d', $days);

            Cache::forget($cacheKey);
            Cache::remember($cacheKey, now()->addMinutes($cacheMinutes), fn () => $metricsService->build($days));

            $this->info(sprintf('Warmed dashboard metrics for %d-day range.', $days));
        }

        return self::SUCCESS;
    }
}
