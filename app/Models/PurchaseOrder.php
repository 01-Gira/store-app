<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class PurchaseOrder extends Model
{
    use HasFactory;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_ORDERED = 'ordered';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_RECEIVED = 'received';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'reference',
        'supplier_id',
        'status',
        'expected_date',
        'ordered_at',
        'received_at',
        'total_cost',
        'notes',
    ];

    protected $casts = [
        'expected_date' => 'date',
        'ordered_at' => 'datetime',
        'received_at' => 'datetime',
        'total_cost' => 'decimal:2',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function isReceivable(): bool
    {
        return in_array($this->status, [
            self::STATUS_ORDERED,
            self::STATUS_PARTIAL,
        ], true);
    }

    protected function totalQuantityOrdered(): Attribute
    {
        return Attribute::make(
            get: fn (): int => $this->sumItems('quantity_ordered')
        );
    }

    protected function totalQuantityReceived(): Attribute
    {
        return Attribute::make(
            get: fn (): int => $this->sumItems('quantity_received')
        );
    }

    protected function outstandingQuantity(): Attribute
    {
        return Attribute::make(
            get: fn (): int => max($this->total_quantity_ordered - $this->total_quantity_received, 0)
        );
    }

    protected function fulfillmentPercentage(): Attribute
    {
        return Attribute::make(
            get: function (): ?float {
                $ordered = $this->total_quantity_ordered;

                if ($ordered <= 0) {
                    return null;
                }

                return round(min($this->total_quantity_received / $ordered, 1), 4);
            }
        );
    }

    protected function actualLeadTimeDays(): Attribute
    {
        return Attribute::make(
            get: function (): ?float {
                if ($this->ordered_at === null || $this->received_at === null) {
                    return null;
                }

                $seconds = $this->received_at->getTimestamp() - $this->ordered_at->getTimestamp();

                return round($seconds / 86400, 2);
            }
        );
    }

    protected function scheduleVarianceDays(): Attribute
    {
        return Attribute::make(
            get: function (): ?float {
                if ($this->expected_date === null) {
                    return null;
                }

                $expected = $this->expected_date->copy()->endOfDay();
                $comparison = ($this->received_at ?? Carbon::now())->copy()->endOfDay();
                $seconds = $comparison->getTimestamp() - $expected->getTimestamp();

                return round($seconds / 86400, 2);
            }
        );
    }

    protected function sumItems(string $column): int
    {
        if ($this->relationLoaded('items')) {
            return (int) $this->items->sum($column);
        }

        return (int) $this->items()->sum($column);
    }
}
