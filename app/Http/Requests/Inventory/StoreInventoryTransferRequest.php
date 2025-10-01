<?php

namespace App\Http\Requests\Inventory;

use App\Models\InventoryLevel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreInventoryTransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user();
    }

    public function rules(): array
    {
        return [
            'source_location_id' => ['required', 'integer', Rule::exists('inventory_locations', 'id'), 'different:destination_location_id'],
            'destination_location_id' => ['required', 'integer', Rule::exists('inventory_locations', 'id')],
            'product_id' => ['required', 'integer', Rule::exists('products', 'id')],
            'quantity' => ['required', 'integer', 'min:1'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $sourceId = (int) $this->input('source_location_id');
            $productId = (int) $this->input('product_id');
            $quantity = (int) $this->input('quantity');

            $level = InventoryLevel::query()
                ->where('inventory_location_id', $sourceId)
                ->where('product_id', $productId)
                ->first();

            $available = $level?->quantity ?? 0;

            if ($available < $quantity) {
                $validator->errors()->add('quantity', 'The source location does not have enough on-hand quantity for this transfer.');
            }
        });
    }
}
