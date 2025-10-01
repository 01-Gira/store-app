<?php

namespace App\Services\Loyalty;

class LoyaltyAdjustment
{
    public function __construct(
        public readonly float $preRedemptionTotal,
        public readonly float $netTotal,
        public readonly int $pointsEarned,
        public readonly int $pointsRedeemed,
        public readonly float $redemptionValue,
    ) {
    }

    public function hasChanges(): bool
    {
        return $this->pointsEarned > 0 || $this->pointsRedeemed > 0;
    }
}
