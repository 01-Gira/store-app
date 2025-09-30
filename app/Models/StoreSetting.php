<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoreSetting extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'ppn_rate',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'ppn_rate' => 'decimal:2',
    ];

    public static function current(): self
    {
        return static::query()->first() ?? static::query()->create([
            'ppn_rate' => 11.0,
        ]);
    }
}
