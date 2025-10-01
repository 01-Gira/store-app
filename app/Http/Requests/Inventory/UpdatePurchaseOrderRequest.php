<?php

namespace App\Http\Requests\Inventory;

use App\Models\PurchaseOrder;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePurchaseOrderRequest extends FormRequest
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
        /** @var PurchaseOrder $purchaseOrder */
        $purchaseOrder = $this->route('purchase_order');

        return [
            'status' => ['sometimes', 'string'],
            'expected_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
