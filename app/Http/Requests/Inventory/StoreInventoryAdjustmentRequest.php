<?php

namespace App\Http\Requests\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class StoreInventoryAdjustmentRequest extends FormRequest
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
            'adjustments' => ['required', 'array', 'min:1'],
            'adjustments.*.product_id' => ['required', 'exists:products,id'],
            'adjustments.*.quantity_delta' => ['required', 'integer', 'not_in:0'],
            'adjustments.*.reason' => ['required', 'string', 'max:255'],
            'adjustments.*.notes' => ['nullable', 'string'],
        ];
    }
}
