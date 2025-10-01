<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerLoyaltyTransaction extends Model
{
    use HasFactory;

    public const TYPE_EARNING = 'earn';
    public const TYPE_REDEMPTION = 'redeem';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'customer_id',
        'transaction_id',
        'type',
        'points_change',
        'points_balance',
        'amount',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'amount' => 'float',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }
}
