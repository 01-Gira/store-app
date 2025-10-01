<?php

namespace App\Services\Loyalty;

use App\Models\Customer;
use App\Models\CustomerLoyaltyTransaction;
use App\Models\Transaction;
use App\Support\Config\StoreConfig;
use InvalidArgumentException;

class TransactionLoyaltyService
{
    public function preview(?Customer $customer, float $total, ?int $requestedPoints): LoyaltyAdjustment
    {
        $preRedemptionTotal = round(max($total, 0), 2);

        if ($customer === null) {
            return new LoyaltyAdjustment($preRedemptionTotal, $preRedemptionTotal, 0, 0, 0.0);
        }

        $pointsPerCurrency = StoreConfig::loyaltyPointsPerCurrency();
        $currencyPerPoint = StoreConfig::loyaltyCurrencyPerPoint();
        $minimumRedeemable = StoreConfig::loyaltyMinimumRedeemablePoints();
        $availablePoints = max((int) $customer->loyalty_points, 0);
        $requested = max((int) ($requestedPoints ?? 0), 0);

        $pointsToRedeem = 0;
        $redemptionValue = 0.0;

        if ($requested > 0 && $currencyPerPoint > 0 && $availablePoints > 0) {
            $pointsToRedeem = min($requested, $availablePoints);
            $maxRedeemableByValue = (int) floor($preRedemptionTotal / $currencyPerPoint);
            if ($maxRedeemableByValue > 0) {
                $pointsToRedeem = min($pointsToRedeem, $maxRedeemableByValue);
            }

            if ($pointsToRedeem < $minimumRedeemable) {
                $pointsToRedeem = 0;
            }

            if ($pointsToRedeem > 0) {
                $redemptionValue = round($pointsToRedeem * $currencyPerPoint, 2);
                $redemptionValue = min($redemptionValue, $preRedemptionTotal);
            }
        }

        $netTotal = round(max($preRedemptionTotal - $redemptionValue, 0), 2);
        $pointsEarned = 0;

        if ($pointsPerCurrency > 0) {
            $rawPoints = $netTotal * $pointsPerCurrency;
            $pointsEarned = $this->roundPoints($rawPoints);
        }

        return new LoyaltyAdjustment(
            $preRedemptionTotal,
            $netTotal,
            $pointsEarned,
            $pointsToRedeem,
            $redemptionValue,
        );
    }

    public function finalize(?Customer $customer, Transaction $transaction, LoyaltyAdjustment $adjustment): void
    {
        if ($customer === null || $transaction->customer_id === null || !$adjustment->hasChanges()) {
            return;
        }

        $balance = (int) $customer->loyalty_points;

        if ($adjustment->pointsRedeemed > 0) {
            if ($balance < $adjustment->pointsRedeemed) {
                throw new InvalidArgumentException('Customer does not have enough loyalty points to redeem.');
            }

            $balance -= $adjustment->pointsRedeemed;

            CustomerLoyaltyTransaction::query()->create([
                'customer_id' => $customer->id,
                'transaction_id' => $transaction->id,
                'type' => CustomerLoyaltyTransaction::TYPE_REDEMPTION,
                'points_change' => -$adjustment->pointsRedeemed,
                'points_balance' => $balance,
                'amount' => $adjustment->redemptionValue,
            ]);
        }

        if ($adjustment->pointsEarned > 0) {
            $balance += $adjustment->pointsEarned;

            CustomerLoyaltyTransaction::query()->create([
                'customer_id' => $customer->id,
                'transaction_id' => $transaction->id,
                'type' => CustomerLoyaltyTransaction::TYPE_EARNING,
                'points_change' => $adjustment->pointsEarned,
                'points_balance' => $balance,
                'amount' => $adjustment->netTotal,
            ]);
        }

        $customer->loyalty_points = $balance;
        $customer->save();
    }

    private function roundPoints(float $value): int
    {
        return match (StoreConfig::loyaltyEarningRounding()) {
            'up' => (int) ceil($value),
            'nearest' => (int) round($value, 0, PHP_ROUND_HALF_UP),
            default => (int) floor($value),
        };
    }
}
