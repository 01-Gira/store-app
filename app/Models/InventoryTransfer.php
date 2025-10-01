<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryTransfer extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'source_inventory_location_id',
        'destination_inventory_location_id',
        'quantity',
        'user_id',
    ];

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function sourceLocation(): BelongsTo
    {
        return $this->belongsTo(InventoryLocation::class, 'source_inventory_location_id');
    }

    public function destinationLocation(): BelongsTo
    {
        return $this->belongsTo(InventoryLocation::class, 'destination_inventory_location_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
