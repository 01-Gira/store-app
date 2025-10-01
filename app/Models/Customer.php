<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'loyalty_number',
        'loyalty_points',
        'enrolled_at',
        'notes',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'enrolled_at' => 'datetime',
        'loyalty_points' => 'integer',
    ];

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }
}
