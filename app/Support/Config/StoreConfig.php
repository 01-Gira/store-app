<?php

namespace App\Support\Config;

use Illuminate\Support\Arr;

class StoreConfig
{
    /**
     * Retrieve the configured loyalty settings array.
     *
     * @return array<string, mixed>
     */
    public static function loyalty(): array
    {
        return config('store.loyalty', []);
    }

    public static function loyaltyPointsPerCurrency(): float
    {
        return (float) Arr::get(self::loyalty(), 'points_per_currency', 0.0);
    }

    public static function loyaltyCurrencyPerPoint(): float
    {
        return (float) Arr::get(self::loyalty(), 'currency_per_point', 0.0);
    }

    public static function loyaltyMinimumRedeemablePoints(): int
    {
        return (int) Arr::get(self::loyalty(), 'minimum_redeemable_points', 0);
    }

    public static function loyaltyEarningRounding(): string
    {
        $mode = (string) Arr::get(self::loyalty(), 'earning_rounding', 'down');

        return match ($mode) {
            'down', 'nearest', 'up' => $mode,
            default => 'down',
        };
    }
}
