<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'supplier_id',
        'barcode',
        'supplier_sku',
        'name',
        'stock',
        'price',
        'cost_price',
        'image_path',
        'reorder_point',
        'reorder_quantity',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'stock' => 'integer',
        'price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'reorder_point' => 'integer',
        'reorder_quantity' => 'integer',
    ];

    /**
     * The categories that belong to the product.
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class)->withTimestamps();
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function inventoryLevels(): HasMany
    {
        return $this->hasMany(InventoryLevel::class);
    }

    public function inventoryAdjustments(): HasMany
    {
        return $this->hasMany(InventoryAdjustment::class);
    }

    public function lots(): HasMany
    {
        return $this->hasMany(ProductLot::class);
    }

    public function scopeBelowReorderPoint(Builder $query, int $fallback): Builder
    {
        return $query->where(static function (Builder $builder) use ($fallback): void {
            $builder
                ->whereNotNull('reorder_point')
                ->whereColumn('stock', '<=', 'reorder_point')
                ->orWhere(static function (Builder $orQuery) use ($fallback): void {
                    $orQuery
                        ->whereNull('reorder_point')
                        ->where('stock', '<=', $fallback);
                });
        });
    }

    public function effectiveReorderPoint(int $fallback): int
    {
        return $this->reorder_point ?? $fallback;
    }

    public function isBelowReorderPoint(int $fallback): bool
    {
        return $this->stock <= $this->effectiveReorderPoint($fallback);
    }

    public function totalStockForLocation(int $locationId): int
    {
        return (int) $this->inventoryLevels
            ->firstWhere('inventory_location_id', $locationId)?->quantity ?? 0;
    }
}
