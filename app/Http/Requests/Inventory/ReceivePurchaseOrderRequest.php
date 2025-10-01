<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class ReceivePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'location_id' => ['required', 'exists:inventory_locations,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'exists:purchase_order_items,id'],
            'items.*.quantity_received' => ['required', 'integer', 'min:0'],
            'items.*.lot_number' => ['nullable', 'string', 'max:255'],
            'items.*.expires_at' => ['nullable', 'date'],
        ];
    }
}
