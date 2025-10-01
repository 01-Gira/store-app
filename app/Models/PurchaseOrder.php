<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
}
