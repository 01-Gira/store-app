<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transaction extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'number',
        'user_id',
        'customer_id',
        'items_count',
        'ppn_rate',
        'subtotal',
        'tax_total',
        'discount_total',
        'total',
        'payment_method',
        'amount_paid',
        'change_due',
        'notes',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'ppn_rate' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'tax_total' => 'decimal:2',
        'discount_total' => 'decimal:2',
        'total' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'change_due' => 'decimal:2',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(TransactionItem::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function scopeWithinPeriod(Builder $query, CarbonInterface $start, CarbonInterface $end): Builder
    {
        return $query->whereBetween('created_at', [$start, $end]);
    }

    public function scopeDailyBreakdown(Builder $query): Builder
    {
        return $query
            ->selectRaw('DATE(created_at) as date')
            ->selectRaw('SUM(total) as revenue')
            ->selectRaw('COUNT(*) as transactions')
            ->selectRaw('SUM(items_count) as items')
            ->groupByRaw('DATE(created_at)')
            ->orderBy('date');
    }
}
