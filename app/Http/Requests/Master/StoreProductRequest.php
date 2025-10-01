<?php

namespace App\Http\Requests\Master;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'supplier_id' => ['nullable', 'integer', Rule::exists('suppliers', 'id')],
            'barcode' => ['required', 'string', 'max:255', Rule::unique('products', 'barcode')],
            'supplier_sku' => ['nullable', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'stock' => ['required', 'integer', 'min:0'],
            'price' => ['required', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'reorder_point' => ['nullable', 'integer', 'min:0'],
            'reorder_quantity' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'image', 'max:5120'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', Rule::exists('categories', 'id')],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'supplier_id' => $this->normalizeNullableInteger('supplier_id'),
            'reorder_point' => $this->normalizeNullableInteger('reorder_point'),
            'reorder_quantity' => $this->normalizeNullableInteger('reorder_quantity'),
            'cost_price' => $this->normalizeNullableNumeric('cost_price'),
        ]);
    }

    private function normalizeNullableInteger(string $key): mixed
    {
        $value = $this->input($key);

        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        return $value;
    }

    private function normalizeNullableNumeric(string $key): mixed
    {
        $value = $this->input($key);

        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return (float) $value;
        }

        return $value;
    }
}
