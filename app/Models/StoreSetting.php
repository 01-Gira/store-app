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
        'store_name',
        'contact_details',
        'logo_path',
        'receipt_footer_text',
        'currency_code',
        'currency_symbol',
        'language_code',
        'timezone',
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
            'store_name' => 'Retail Store',
            'contact_details' => null,
            'logo_path' => null,
            'receipt_footer_text' => null,
            'currency_code' => 'IDR',
            'currency_symbol' => 'Rp',
            'language_code' => 'id-ID',
            'timezone' => 'Asia/Jakarta',
        ]);
    }
}
