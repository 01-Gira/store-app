<?php

namespace App\Http\Requests\Transactions;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreTransactionRequest extends FormRequest
{
    /**
     * Supported payment methods for a transaction.
     *
     * @var list<string>
     */
    public const PAYMENT_METHODS = [
        'cash',
        'card',
        'bank_transfer',
        'e_wallet',
        'other',
    ];

    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'discount_type' => $this->filled('discount_type') ? $this->input('discount_type') : null,
            'discount_value' => $this->filled('discount_value') ? $this->input('discount_value') : null,
            'notes' => $this->filled('notes') ? $this->input('notes') : null,
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'discount_type' => ['nullable', 'string', Rule::in(['percentage', 'value'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['required', 'string', Rule::in(self::PAYMENT_METHODS)],
            'amount_paid' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $discountType = $this->input('discount_type');
            $rawDiscountValue = $this->input('discount_value');

            if ($discountType === null && $rawDiscountValue !== null && $rawDiscountValue !== '') {
                $validator->errors()->add('discount_type', 'Select a discount type when providing a discount value.');
            }

            if ($discountType !== null && ($rawDiscountValue === null || $rawDiscountValue === '')) {
                $validator->errors()->add('discount_value', 'Provide a value for the selected discount type.');
            }

            if ($discountType === 'percentage' && is_numeric($rawDiscountValue) && (float) $rawDiscountValue > 100) {
                $validator->errors()->add('discount_value', 'Percentage discounts cannot exceed 100%.');
            }
        });
    }
}
