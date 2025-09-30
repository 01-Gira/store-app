<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TransactionItem extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'transaction_id',
        'product_id',
        'barcode',
        'name',
        'quantity',
        'unit_price',
        'tax_rate',
        'tax_amount',
        'line_total',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
    ];

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
